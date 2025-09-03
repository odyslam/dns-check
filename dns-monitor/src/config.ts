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
    {
      domain: 'example.com',
      expectedIPs: ['93.184.216.34'],
      recordType: 'A',
    },
    {
      domain: 'google.com',
      expectedIPs: [
        '142.250.185.78',
        '142.250.185.110',
        '142.250.185.100',
        '142.250.185.101',
        '142.250.185.102',
        '142.250.185.113',
      ],
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