import { DomainConfig } from './types';
import { parse } from 'smol-toml';

export interface AppConfig {
  domains: DomainConfig[];
  telegram?: {
    botToken: string;
    chatId: string;
  };
}

interface TomlConfig {
  notifications?: {
    telegram?: {
      enabled: boolean;
    };
  };
  domains: Array<{
    name?: string;
    domain: string;
    record_type?: 'A' | 'AAAA' | 'CNAME' | 'NS';
    category?: string;
  }>;
}

// Fallback configuration if TOML is not provided
export const fallbackConfig: DomainConfig[] = [
  { name: 'Uniswap', domain: 'app.uniswap.org', category: 'defi' },
  { name: 'AAVE', domain: 'aave.com', category: 'defi' },
  { name: 'Curve Finance', domain: 'curve.fi', category: 'defi' },
];

export function loadConfig(env: any, tomlContent?: string): AppConfig {
  try {
    // First try to use TOML content if provided
    if (tomlContent) {
      const tomlConfig = parse(tomlContent) as TomlConfig;
      
      // Convert TOML format to internal format
      const domains: DomainConfig[] = tomlConfig.domains.map(d => ({
        name: d.name,
        domain: d.domain,
        recordType: d.record_type || 'A',
        category: d.category,
      }));
      
      return {
        domains,
        telegram: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? {
          botToken: env.TELEGRAM_BOT_TOKEN,
          chatId: env.TELEGRAM_CHAT_ID,
        } : undefined,
      };
    }
    
    // Fallback to environment variable JSON config
    if (env.DNS_MONITOR_CONFIG) {
      const config = JSON.parse(env.DNS_MONITOR_CONFIG);
      return {
        domains: config.domains || fallbackConfig,
        telegram: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? {
          botToken: env.TELEGRAM_BOT_TOKEN,
          chatId: env.TELEGRAM_CHAT_ID,
        } : undefined,
      };
    }
    
    // Use fallback config
    return {
      domains: fallbackConfig,
      telegram: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? {
        botToken: env.TELEGRAM_BOT_TOKEN,
        chatId: env.TELEGRAM_CHAT_ID,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to parse config:', error);
    return {
      domains: fallbackConfig,
      telegram: undefined,
    };
  }
}