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
    {
      domain: 'app.uniswap.org',
      expectedIPs: ['172.66.0.225', '162.159.140.227'],
      recordType: 'A',
    },
    {
      domain: 'aave.com',
      expectedIPs: ['104.18.21.145', '104.18.20.145'],
      recordType: 'A',
    },
    {
      domain: 'curve.fi',
      expectedIPs: ['104.26.1.50', '104.26.0.50', '172.67.73.144'],
      recordType: 'A',
    },
    {
      domain: 'lido.fi',
      expectedIPs: ['104.18.24.198', '104.18.25.198'],
      recordType: 'A',
    },
    {
      domain: 'makerdao.com',
      expectedIPs: ['104.26.14.15', '172.67.74.86', '104.26.15.15'],
      recordType: 'A',
    },
    {
      domain: 'sky.money',
      expectedIPs: ['104.18.20.177', '104.18.21.177'],
      recordType: 'A',
    },
    {
      domain: 'compound.finance',
      expectedIPs: ['104.18.29.126', '104.18.28.126'],
      recordType: 'A',
    },
    {
      domain: 'sushi.com',
      expectedIPs: ['64.239.123.129', '64.239.123.1'],
      recordType: 'A',
    },
    {
      domain: 'pancakeswap.finance',
      expectedIPs: ['104.26.3.169', '172.67.75.76', '104.26.2.169'],
      recordType: 'A',
    },
    {
      domain: 'balancer.fi',
      expectedIPs: ['216.150.1.1'],
      recordType: 'A',
    },
    {
      domain: 'convex.finance',
      expectedIPs: ['76.223.54.146', '13.248.169.48'],
      recordType: 'A',
    },
    {
      domain: 'yearn.finance',
      expectedIPs: ['76.76.21.21'],
      recordType: 'A',
    },
    {
      domain: 'summer.fi',
      expectedIPs: ['18.165.72.82', '18.165.72.86', '18.165.72.123', '18.165.72.84'],
      recordType: 'A',
    },
    {
      domain: '1inch.io',
      expectedIPs: ['172.64.148.206', '104.18.39.50'],
      recordType: 'A',
    },
    {
      domain: 'synthetix.io',
      expectedIPs: ['75.2.70.75', '99.83.190.102'],
      recordType: 'A',
    },
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