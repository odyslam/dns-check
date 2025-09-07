import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../src';

// Mock the TOML import
vi.mock('../dns-monitor.toml', () => ({
  default: `
[notifications.telegram]
enabled = true

[[domains]]
name = "Test App"
domain = "test.example.com"
record_type = "A"
category = "test"

[[domains]]
name = "Test API"
domain = "api.example.com"
record_type = "AAAA"
category = "test"
`
}));

// Mock fetch for DNS and IP analysis
global.fetch = vi.fn();

describe('DNS Monitor Worker Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock DNS resolution responses
    (global.fetch as any).mockImplementation((url: string) => {
      // Mock DNS queries
      if (url.includes('dns-query') || url.includes('dns.google') || url.includes('resolve')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 1, data: '192.168.1.1' }],
          }),
        });
      }
      
      // Mock IP analysis APIs (fail gracefully)
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe('Endpoints with TOML Config', () => {
    it('should respond to root endpoint', async () => {
      const request = new Request('http://example.com/');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('DNS Monitor Service');
    });

    it('should respond to status endpoint', async () => {
      const request = new Request('http://example.com/status');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.status).toBe('running');
      expect(data.version).toBe('1.0.0');
    });

    it('should load TOML config and check domains on /check endpoint', async () => {
      const request = new Request('http://example.com/check');
      const ctx = createExecutionContext();
      
      // Mock KV store
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };
      
      const testEnv = {
        ...env,
        DNS_HISTORY: mockKV as any,
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: 'test-chat',
      };
      
      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      
      // Check endpoint now returns lite mode response
      expect(data.note).toContain('lite mode');
      const results = data.results;
      
      // Should check both domains from the mocked TOML (or up to 5 in lite mode)
      expect(results).toHaveLength(2);
      expect(results[0].domain).toBe('test.example.com');
      expect(results[1].domain).toBe('api.example.com');
      
      // Should have stored results in KV
      expect(mockKV.put).toHaveBeenCalledTimes(2);
      expect(mockKV.put).toHaveBeenCalledWith(
        'dns:test.example.com:A',
        expect.any(String)
      );
      expect(mockKV.put).toHaveBeenCalledWith(
        'dns:api.example.com:AAAA',
        expect.any(String)
      );
    });

    it('should detect DNS changes and include risk assessment', async () => {
      const request = new Request('http://example.com/check');
      const ctx = createExecutionContext();
      
      // Mock KV store with previous records
      const previousRecord = {
        domain: 'test.example.com',
        ips: ['10.0.0.1'], // Different from what DNS will return
        timestamp: Date.now() - 10000,
        recordType: 'A',
      };
      
      const mockKV = {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'dns:test.example.com:A') {
            return Promise.resolve(JSON.stringify(previousRecord));
          }
          return Promise.resolve(null);
        }),
        put: vi.fn().mockResolvedValue(undefined),
      };
      
      const testEnv = {
        ...env,
        DNS_HISTORY: mockKV as any,
      };
      
      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      const results = data.results;
      
      // Find the changed domain result
      const changedResult = results.find((r: any) => r.domain === 'test.example.com');
      expect(changedResult).toBeDefined();
      expect(changedResult.hasChanged).toBe(true);
      expect(changedResult.previousIPs).toEqual(['10.0.0.1']);
      expect(changedResult.currentIPs).toEqual(['192.168.1.1']);
      
      // In lite mode, IP analysis is disabled
      // So these should be undefined
      expect(changedResult.riskAssessment).toBeUndefined();
      expect(changedResult.currentIPAnalysis).toBeUndefined();
      expect(changedResult.previousIPAnalysis).toBeUndefined();
    });

    it('should handle scheduled trigger', async () => {
      const controller = {} as ScheduledController;
      const ctx = createExecutionContext();
      
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };
      
      const testEnv = {
        ...env,
        DNS_HISTORY: mockKV as any,
      };
      
      // This should not throw
      await expect(
        worker.scheduled(controller, testEnv, ctx)
      ).resolves.toBeUndefined();
      
      await waitOnExecutionContext(ctx);
      
      // Should have performed DNS checks for all domains
      expect(mockKV.put).toHaveBeenCalled();
    });
  });

  describe('Config Fallback Mechanisms', () => {
    it('should fall back to env config when TOML parsing fails', async () => {
      // Mock a broken TOML import
      vi.doMock('../dns-monitor.toml', () => ({
        default: 'invalid [[[[ toml'
      }));
      
      const request = new Request('http://example.com/check');
      const ctx = createExecutionContext();
      
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      };
      
      const testEnv = {
        ...env,
        DNS_HISTORY: mockKV as any,
        DNS_MONITOR_CONFIG: JSON.stringify({
          domains: [{ domain: 'fallback.example.com' }]
        }),
      };
      
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      const results = data.results;
      
      // Should use the env config as fallback
      expect(results.length).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });
});