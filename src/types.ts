export interface DomainConfig {
  domain: string;
  expectedIPs: string[];
  recordType?: 'A' | 'AAAA' | 'CNAME';
}

export interface DNSCheckResult {
  domain: string;
  timestamp: number;
  isHijacked: boolean;
  expectedIPs: string[];
  actualIPs: string[];
  error?: string;
}

export interface NotificationHandler {
  name: string;
  notify(results: DNSCheckResult[]): Promise<void>;
}

export interface Config {
  domains: DomainConfig[];
  notificationHandlers: NotificationHandler[];
}