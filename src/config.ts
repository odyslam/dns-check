import { DomainConfig } from './types';

export interface AppConfig {
  domains: DomainConfig[];
  telegram?: {
    botToken: string;
    chatId: string;
  };
}

// Default configuration - users should override this
export const defaultConfig: AppConfig = {
  domains: [
    // Major DeFi Protocols
    { domain: 'app.uniswap.org' },
    { domain: 'aave.com' },
    { domain: 'curve.fi' },
    { domain: 'lido.fi' },
    { domain: 'makerdao.com' },
    { domain: 'sky.money' },
    { domain: 'compound.finance' },
    { domain: 'sushi.com' },
    { domain: 'pancakeswap.finance' },
    { domain: 'balancer.fi' },
    { domain: 'convex.finance' },
    { domain: 'yearn.finance' },
    { domain: 'summer.fi' },
    { domain: '1inch.io' },
    { domain: 'synthetix.io' },
  ],
  telegram: {
    botToken: 'YOUR_BOT_TOKEN',
    chatId: 'YOUR_CHAT_ID',
  },
};

export function loadConfig(env: any): AppConfig {
  // Load config from environment variables or KV store
  const configJson = env.DNS_MONITOR_CONFIG || JSON.stringify(defaultConfig);
  
  try {
    return JSON.parse(configJson);
  } catch (error) {
    console.error('Failed to parse config, using default:', error);
    return defaultConfig;
  }
}