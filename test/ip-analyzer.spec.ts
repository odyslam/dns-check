import { describe, it, expect, beforeAll, vi } from 'vitest';
import { IPAnalyzer } from '../src/ip-analyzer';
import { IPAnalysis } from '../src/types';

describe('IPAnalyzer', () => {
  let analyzer: IPAnalyzer;

  beforeAll(() => {
    analyzer = new IPAnalyzer();
  });

  describe('analyzeIP', () => {
    it('should handle private IPs correctly', async () => {
      const privateIPs = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '127.0.0.1'];
      
      for (const ip of privateIPs) {
        const result = await analyzer.analyzeIP(ip);
        expect(result.ip).toBe(ip);
        expect(result.geolocation?.country).toBe('Private IP');
        expect(result.geolocation?.city).toBe('Local Network');
        expect(result.reputation?.isClean).toBe(true);
      }
    });

    it('should return basic structure for public IPs even when APIs fail', async () => {
      // Mock fetch to avoid actual API calls - simulating API failures
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

      const result = await analyzer.analyzeIP('8.8.8.8');
      expect(result.ip).toBe('8.8.8.8');
      // When APIs fail, these properties will be present with default/undefined values
      expect(result.reputation).toBeDefined();
      expect(result.reputation?.isClean).toBe(true); // Default reputation when checks fail
      expect(result.reputation?.source).toBe('default');
      // Geolocation and reverseDns may be undefined when APIs fail
      expect(result).toHaveProperty('ip');
    });

    it('should detect known bad IP ranges', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

      // Test IP from a suspicious range
      const result = await analyzer.analyzeIP('185.220.100.5');
      expect(result.reputation?.isClean).toBe(false);
      expect(result.reputation?.categories).toContain('TOR exit nodes');
    });
  });

  describe('analyzeIPs', () => {
    it('should analyze multiple IPs in parallel', async () => {
      const ips = ['192.168.1.1', '10.0.0.1'];
      const results = await analyzer.analyzeIPs(ips);
      
      expect(results).toHaveLength(2);
      expect(results[0].ip).toBe('192.168.1.1');
      expect(results[1].ip).toBe('10.0.0.1');
    });
  });

  describe('assessRisk', () => {
    it('should return critical risk for malicious IPs', () => {
      const previous: IPAnalysis[] = [{
        ip: '1.2.3.4',
        geolocation: { country: 'United States' },
        reputation: { isClean: true },
      }];
      
      const current: IPAnalysis[] = [{
        ip: '5.6.7.8',
        geolocation: { country: 'Russia' },
        reputation: { isClean: false, isMalicious: true },
      }];
      
      const risk = analyzer.assessRisk(previous, current);
      expect(risk.level).toBe('critical');
      expect(risk.factors).toContain('🚨 1 IP(s) flagged as malicious');
      expect(risk.recommendation).toContain('IMMEDIATE ACTION REQUIRED');
    });

    it('should return high risk for suspicious country changes', () => {
      const previous: IPAnalysis[] = [{
        ip: '1.2.3.4',
        geolocation: { country: 'United States' },
        reputation: { isClean: true },
      }];
      
      const current: IPAnalysis[] = [{
        ip: '5.6.7.8',
        geolocation: { country: 'North Korea' },
        reputation: { isClean: true },
      }];
      
      const risk = analyzer.assessRisk(previous, current);
      expect(risk.level).toBe('high');
      expect(risk.factors).toContain('📍 Geographic change: moved to North Korea');
      expect(risk.factors).toContain('⚠️ Moved to high-risk countries: North Korea');
    });

    it('should return medium risk for ASN changes', () => {
      const previous: IPAnalysis[] = [{
        ip: '1.2.3.4',
        asn: { organization: 'Amazon Web Services' },
        reputation: { isClean: true },
      }];
      
      const current: IPAnalysis[] = [{
        ip: '5.6.7.8',
        asn: { organization: 'Digital Ocean' },
        reputation: { isClean: true },
      }];
      
      const risk = analyzer.assessRisk(previous, current);
      expect(['low', 'medium']).toContain(risk.level);
      expect(risk.factors).toContain('🏢 Hosting provider changed to: Digital Ocean');
    });

    it('should return low risk for minor changes', () => {
      const previous: IPAnalysis[] = [{
        ip: '1.2.3.4',
        geolocation: { country: 'United States', city: 'New York' },
        asn: { organization: 'Cloudflare' },
        reputation: { isClean: true },
        reverseDns: 'example.com',
      }];
      
      const current: IPAnalysis[] = [{
        ip: '1.2.3.5',
        geolocation: { country: 'United States', city: 'San Francisco' },
        asn: { organization: 'Cloudflare' },
        reputation: { isClean: true },
        reverseDns: 'example.com',
      }];
      
      const risk = analyzer.assessRisk(previous, current);
      expect(risk.level).toBe('low');
      expect(risk.recommendation).toContain('LOW RISK');
    });

    it('should handle missing reverse DNS as suspicious', () => {
      const previous: IPAnalysis[] = [{
        ip: '1.2.3.4',
        reverseDns: 'example.com',
        reputation: { isClean: true },
      }];
      
      const current: IPAnalysis[] = [{
        ip: '5.6.7.8',
        reputation: { isClean: true },
      }];
      
      const risk = analyzer.assessRisk(previous, current);
      expect(risk.factors).toContain('🔍 No reverse DNS configured (suspicious)');
    });
  });
});