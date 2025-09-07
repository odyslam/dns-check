import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DNSChecker } from '../src/dns-checker';
import type { DomainConfig, DNSRecord, IPAnalysis } from '../src/types';

// Mock KV namespace
const mockKVNamespace = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

// Mock global fetch
global.fetch = vi.fn();

describe('DNSChecker', () => {
  let dnsChecker: DNSChecker;

  beforeEach(() => {
    vi.clearAllMocks();
    dnsChecker = new DNSChecker(mockKVNamespace as any);
  });

  describe('resolveDomainMultiple', () => {
    it('should query multiple DNS resolvers in parallel', async () => {
      const mockResponses = {
        'cloudflare-dns.com': {
          Status: 0,
          Answer: [{ type: 1, data: '192.168.1.1' }],
        },
        'dns.google': {
          Status: 0,
          Answer: [{ type: 1, data: '192.168.1.1' }],
        },
        'dns.quad9.net': {
          Status: 0,
          Answer: [{ type: 1, data: '192.168.1.1' }],
        },
      };

      (global.fetch as any).mockImplementation((url: string) => {
        const responseData = url.includes('cloudflare') ? mockResponses['cloudflare-dns.com'] :
                            url.includes('google') ? mockResponses['dns.google'] :
                            mockResponses['dns.quad9.net'];
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(responseData),
        });
      });

      const result = await dnsChecker['resolveDomainMultiple']('example.com', 'A');

      expect(result).toEqual({
        Cloudflare: ['192.168.1.1'],
        Google: ['192.168.1.1'],
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should detect resolver discrepancies', async () => {
      const mockResponses = {
        'cloudflare-dns.com': {
          Status: 0,
          Answer: [{ type: 1, data: '192.168.1.1' }],
        },
        'dns.google': {
          Status: 0,
          Answer: [{ type: 1, data: '192.168.1.2' }], // Different IP
        },
        'dns.quad9.net': {
          Status: 0,
          Answer: [{ type: 1, data: '192.168.1.1' }],
        },
      };

      (global.fetch as any).mockImplementation((url: string) => {
        const responseData = url.includes('cloudflare') ? mockResponses['cloudflare-dns.com'] :
                            url.includes('google') ? mockResponses['dns.google'] :
                            mockResponses['dns.quad9.net'];
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(responseData),
        });
      });

      mockKVNamespace.get.mockResolvedValue(null);
      mockKVNamespace.put.mockResolvedValue(undefined);

      const config: DomainConfig = { domain: 'example.com' };
      const result = await dnsChecker.checkDomain(config);

      expect(result.resolverDiscrepancy).toBe(true);
      expect(result.resolverResults).toEqual({
        Cloudflare: ['192.168.1.1'],
        Google: ['192.168.1.2'],
      });
    });

    it('should handle failed resolver queries gracefully', async () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('google')) {
          return Promise.reject(new Error('Network error'));
        }
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            Status: 0,
            Answer: [{ type: 1, data: '192.168.1.1' }],
          }),
        });
      });

      const result = await dnsChecker['resolveDomainMultiple']('example.com', 'A');

      expect(result.Google).toEqual([]);
      expect(result.Cloudflare).toEqual(['192.168.1.1']);
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe('checkDomain', () => {
    it('should detect DNS changes and include IP analysis', async () => {
      const previousRecord: DNSRecord = {
        domain: 'example.com',
        ips: ['192.168.1.1'],
        timestamp: Date.now() - 1000,
        recordType: 'A',
      };

      mockKVNamespace.get.mockResolvedValue(JSON.stringify(previousRecord));
      mockKVNamespace.put.mockResolvedValue(undefined);

      (global.fetch as any).mockImplementation((url: string) => {
        // Mock DNS resolution
        if (url.includes('dns-query') || url.includes('dns.google') || url.includes('resolve')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              Status: 0,
              Answer: [{ type: 1, data: '192.168.1.2' }], // Changed IP
            }),
          });
        }
        // Mock IP analysis APIs (will fail, but that's expected in tests)
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        });
      });

      const config: DomainConfig = { domain: 'example.com' };
      const result = await dnsChecker.checkDomain(config);

      // Check if there was an error
      if (result.error) {
        console.error('Error in DNS check:', result.error);
      }

      expect(result.hasChanged).toBe(true);
      expect(result.isFirstCheck).toBe(false); // Should not be first check
      expect(result.previousIPs).toEqual(['192.168.1.1']);
      expect(result.currentIPs.length).toBeGreaterThan(0);
      expect(result.currentIPs).toContain('192.168.1.2');
      
      // IP analysis is now conditional based on changes
      if (result.hasChanged && !result.isFirstCheck) {
        expect(result.currentIPAnalysis).toBeDefined();
        expect(result.previousIPAnalysis).toBeDefined();
        expect(result.riskAssessment).toBeDefined();
      }
    });

    it('should support NS record type', async () => {
      mockKVNamespace.get.mockResolvedValue(null);
      mockKVNamespace.put.mockResolvedValue(undefined);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          Status: 0,
          Answer: [{ type: 2, data: 'ns1.example.com' }], // NS record
        }),
      });

      const config: DomainConfig = { domain: 'example.com', recordType: 'NS' };
      const result = await dnsChecker.checkDomain(config);

      expect(result.currentIPs).toEqual(['ns1.example.com']);
      expect(mockKVNamespace.put).toHaveBeenCalledWith(
        'dns:example.com:NS',
        expect.any(String)
      );
    });

    it('should include cache-busting parameters', async () => {
      mockKVNamespace.get.mockResolvedValue(null);
      mockKVNamespace.put.mockResolvedValue(undefined);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          Status: 0,
          Answer: [],
        }),
      });

      const config: DomainConfig = { domain: 'example.com' };
      await dnsChecker.checkDomain(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cb='),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cache-Control': 'no-cache, no-store',
          }),
        })
      );
    });
    
    it('should not perform IP analysis for CNAME records', async () => {
      mockKVNamespace.get.mockResolvedValue(null);
      mockKVNamespace.put.mockResolvedValue(undefined);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          Status: 0,
          Answer: [{ type: 5, data: 'alias.example.com' }], // CNAME record
        }),
      });

      const config: DomainConfig = { domain: 'example.com', recordType: 'CNAME' };
      const result = await dnsChecker.checkDomain(config);

      expect(result.currentIPs).toEqual(['alias.example.com']);
      expect(result.currentIPAnalysis).toBeUndefined();
      expect(result.riskAssessment).toBeUndefined();
    });
  });

  describe('getMostCommonResult', () => {
    it('should return the most common result when resolvers differ', () => {
      const resolverResults = {
        Cloudflare: ['192.168.1.1', '192.168.1.2'],
        Google: ['192.168.1.1', '192.168.1.2'],
        Quad9: ['192.168.1.3'],
      };

      const result = dnsChecker['getMostCommonResult'](resolverResults);
      expect(result).toEqual(['192.168.1.1', '192.168.1.2']);
    });

    it('should handle empty results', () => {
      const resolverResults = {
        Cloudflare: [],
        Google: [],
        Quad9: [],
      };

      const result = dnsChecker['getMostCommonResult'](resolverResults);
      expect(result).toEqual([]);
    });
  });

  describe('checkResolverDiscrepancy', () => {
    it('should detect discrepancies between resolvers', () => {
      const resolverResults = {
        Cloudflare: ['192.168.1.1'],
        Google: ['192.168.1.2'],
      };

      const result = dnsChecker['checkResolverDiscrepancy'](resolverResults);
      expect(result).toBe(true);
    });

    it('should return false when all resolvers agree', () => {
      const resolverResults = {
        Cloudflare: ['192.168.1.1'],
        Google: ['192.168.1.1'],
        Quad9: ['192.168.1.1'],
      };

      const result = dnsChecker['checkResolverDiscrepancy'](resolverResults);
      expect(result).toBe(false);
    });

    it('should handle different IP orders', () => {
      const resolverResults = {
        Cloudflare: ['192.168.1.1', '192.168.1.2'],
        Google: ['192.168.1.2', '192.168.1.1'],
      };

      const result = dnsChecker['checkResolverDiscrepancy'](resolverResults);
      expect(result).toBe(false);
    });
  });
});