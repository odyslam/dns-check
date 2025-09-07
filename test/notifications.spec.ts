import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseNotificationHandler } from '../src/notifications/base';
import { TelegramNotificationHandler } from '../src/notifications/telegram';
import type { DNSCheckResult } from '../src/types';

// Create a concrete test implementation of BaseNotificationHandler
class TestNotificationHandler extends BaseNotificationHandler {
  name = 'Test';
  notify = vi.fn();
}

// Mock global fetch
global.fetch = vi.fn();

describe('BaseNotificationHandler', () => {
  let handler: TestNotificationHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new TestNotificationHandler();
  });

  describe('filterChangedResults', () => {
    it('should filter results with DNS changes', () => {
      const results: DNSCheckResult[] = [
        {
          domain: 'example1.com',
          timestamp: Date.now(),
          hasChanged: true,
          isFirstCheck: false,
          previousIPs: ['192.168.1.1'],
          currentIPs: ['192.168.1.2'],
        },
        {
          domain: 'example2.com',
          timestamp: Date.now(),
          hasChanged: false,
          isFirstCheck: false,
          previousIPs: ['192.168.1.1'],
          currentIPs: ['192.168.1.1'],
        },
      ];

      const filtered = handler['filterChangedResults'](results);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].domain).toBe('example1.com');
    });

    it('should filter results with resolver discrepancies', () => {
      const results: DNSCheckResult[] = [
        {
          domain: 'example.com',
          timestamp: Date.now(),
          hasChanged: false,
          isFirstCheck: false,
          previousIPs: ['192.168.1.1'],
          currentIPs: ['192.168.1.1'],
          resolverDiscrepancy: true,
          resolverResults: {
            Cloudflare: ['192.168.1.1'],
            Google: ['192.168.1.2'],
          },
        },
      ];

      const filtered = handler['filterChangedResults'](results);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].resolverDiscrepancy).toBe(true);
    });

    it('should not include first check results', () => {
      const results: DNSCheckResult[] = [
        {
          domain: 'example.com',
          timestamp: Date.now(),
          hasChanged: true,
          isFirstCheck: true,
          previousIPs: [],
          currentIPs: ['192.168.1.1'],
        },
      ];

      const filtered = handler['filterChangedResults'](results);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('formatMessage', () => {
    it('should format DNS change messages', () => {
      const results: DNSCheckResult[] = [
        {
          domain: 'example.com',
          timestamp: Date.now(),
          hasChanged: true,
          isFirstCheck: false,
          previousIPs: ['192.168.1.1'],
          currentIPs: ['192.168.1.2'],
        },
      ];

      const message = handler['formatMessage'](results);
      
      expect(message).toContain('DNS Changes/Discrepancies Detected!');
      expect(message).toContain('example.com');
      expect(message).toContain('192.168.1.1');
      expect(message).toContain('192.168.1.2');
      expect(message).toContain('DNS records changed');
    });

    it('should format resolver discrepancy messages', () => {
      const results: DNSCheckResult[] = [
        {
          domain: 'example.com',
          timestamp: Date.now(),
          hasChanged: false,
          isFirstCheck: false,
          previousIPs: ['192.168.1.1'],
          currentIPs: ['192.168.1.1'],
          resolverDiscrepancy: true,
          resolverResults: {
            Cloudflare: ['192.168.1.1'],
            Google: ['192.168.1.2'],
            Quad9: ['192.168.1.1'],
          },
        },
      ];

      const message = handler['formatMessage'](results);
      
      expect(message).toContain('ALERT: Resolver Discrepancy Detected!');
      expect(message).toContain('DNS hijacking attempt');
      expect(message).toContain('Cloudflare: 192.168.1.1');
      expect(message).toContain('Google: 192.168.1.2');
      expect(message).toContain('Quad9: 192.168.1.1');
    });

    it('should include both DNS changes and resolver discrepancies', () => {
      const results: DNSCheckResult[] = [
        {
          domain: 'example.com',
          timestamp: Date.now(),
          hasChanged: true,
          isFirstCheck: false,
          previousIPs: ['192.168.1.1'],
          currentIPs: ['192.168.1.2'],
          resolverDiscrepancy: true,
          resolverResults: {
            Cloudflare: ['192.168.1.2'],
            Google: ['192.168.1.3'],
          },
        },
      ];

      const message = handler['formatMessage'](results);
      
      expect(message).toContain('DNS records changed');
      expect(message).toContain('ALERT: Resolver Discrepancy Detected!');
    });

    it('should handle error results', () => {
      const results: DNSCheckResult[] = [
        {
          domain: 'example.com',
          timestamp: Date.now(),
          hasChanged: true,
          isFirstCheck: false,
          previousIPs: [],
          currentIPs: [],
          error: 'DNS query failed',
        },
      ];

      const message = handler['formatMessage'](results);
      
      expect(message).toContain('DNS query failed');
    });

    it('should return success message for empty results', () => {
      const message = handler['formatMessage']([]);
      expect(message).toContain('All domains are resolving to their expected IPs');
    });
  });
});

describe('TelegramNotificationHandler', () => {
  let handler: TelegramNotificationHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new TelegramNotificationHandler({
      botToken: 'test-token',
      chatId: 'test-chat',
    });
  });

  it('should send notifications for changed results', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"ok":true}'),
    });

    const results: DNSCheckResult[] = [
      {
        domain: 'example.com',
        timestamp: Date.now(),
        hasChanged: true,
        isFirstCheck: false,
        previousIPs: ['192.168.1.1'],
        currentIPs: ['192.168.1.2'],
      },
    ];

    await handler.notify(results);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('test-chat'),
      })
    );
  });

  it('should not send notifications when no changes detected', async () => {
    const results: DNSCheckResult[] = [
      {
        domain: 'example.com',
        timestamp: Date.now(),
        hasChanged: false,
        isFirstCheck: false,
        previousIPs: ['192.168.1.1'],
        currentIPs: ['192.168.1.1'],
      },
    ];

    await handler.notify(results);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle Telegram API errors', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('{"error_code":401,"description":"Unauthorized"}'),
    });

    const results: DNSCheckResult[] = [
      {
        domain: 'example.com',
        timestamp: Date.now(),
        hasChanged: true,
        isFirstCheck: false,
        previousIPs: ['192.168.1.1'],
        currentIPs: ['192.168.1.2'],
      },
    ];

    await expect(handler.notify(results)).rejects.toThrow('Failed to send Telegram message');
  });
});