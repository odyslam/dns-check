import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../src/config';

// Mock TOML content
const mockTomlContent = `
[notifications.telegram]
enabled = true

[[domains]]
name = "Test Service 1"
domain = "test1.example.com"
record_type = "A"
category = "test"

[[domains]]
name = "Test Service 2"
domain = "test2.example.com"
record_type = "AAAA"
category = "test"

[[domains]]
domain = "test3.example.com"
# No name, record_type, or category - testing defaults
`;

describe('Config Loading', () => {
  describe('loadConfig', () => {
    it('should parse TOML configuration correctly', () => {
      const env = {
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: 'test-chat',
      };

      const config = loadConfig(env, mockTomlContent);

      expect(config.domains).toHaveLength(3);
      
      // First domain with all fields
      expect(config.domains[0]).toEqual({
        name: 'Test Service 1',
        domain: 'test1.example.com',
        recordType: 'A',
        category: 'test',
      });
      
      // Second domain with AAAA record
      expect(config.domains[1]).toEqual({
        name: 'Test Service 2',
        domain: 'test2.example.com',
        recordType: 'AAAA',
        category: 'test',
      });
      
      // Third domain with defaults
      expect(config.domains[2]).toEqual({
        name: undefined,
        domain: 'test3.example.com',
        recordType: 'A', // Default value
        category: undefined,
      });

      // Telegram config from environment
      expect(config.telegram).toEqual({
        botToken: 'test-token',
        chatId: 'test-chat',
      });
    });

    it('should handle missing TOML and fall back to environment config', () => {
      const env = {
        DNS_MONITOR_CONFIG: JSON.stringify({
          domains: [
            { domain: 'env.example.com', recordType: 'A' },
          ],
        }),
        TELEGRAM_BOT_TOKEN: 'env-token',
        TELEGRAM_CHAT_ID: 'env-chat',
      };

      const config = loadConfig(env, undefined);

      expect(config.domains).toHaveLength(1);
      expect(config.domains[0].domain).toBe('env.example.com');
      expect(config.telegram?.botToken).toBe('env-token');
    });

    it('should use fallback config when no TOML or env config provided', () => {
      const env = {};
      const config = loadConfig(env, undefined);

      expect(config.domains.length).toBeGreaterThan(0);
      expect(config.domains[0]).toHaveProperty('domain');
      expect(config.domains[0]).toHaveProperty('category', 'defi');
      expect(config.telegram).toBeUndefined();
    });

    it('should handle invalid TOML gracefully', () => {
      const env = {};
      const invalidToml = 'this is not valid TOML [[[';
      
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const config = loadConfig(env, invalidToml);

      expect(config.domains.length).toBeGreaterThan(0); // Falls back to default
      expect(config.telegram).toBeUndefined();
      
      consoleSpy.mockRestore();
    });

    it('should not include telegram config if tokens are missing', () => {
      const env = {
        TELEGRAM_BOT_TOKEN: undefined,
        TELEGRAM_CHAT_ID: 'chat-only',
      };

      const config = loadConfig(env, mockTomlContent);

      expect(config.telegram).toBeUndefined();
    });

    it('should handle the actual dns-monitor.toml structure', () => {
      const actualTomlContent = `
# DNS Monitor Configuration
[notifications.telegram]
enabled = true

[[domains]]
name = "Uniswap"
domain = "app.uniswap.org"
record_type = "A"
category = "defi"

[[domains]]
name = "AAVE"
domain = "aave.com"
record_type = "A"
category = "defi"
`;

      const env = {
        TELEGRAM_BOT_TOKEN: 'prod-token',
        TELEGRAM_CHAT_ID: 'prod-chat',
      };

      const config = loadConfig(env, actualTomlContent);

      expect(config.domains).toHaveLength(2);
      expect(config.domains[0]).toEqual({
        name: 'Uniswap',
        domain: 'app.uniswap.org',
        recordType: 'A',
        category: 'defi',
      });
      expect(config.domains[1]).toEqual({
        name: 'AAVE',
        domain: 'aave.com',
        recordType: 'A',
        category: 'defi',
      });
    });
  });
});