export interface DomainConfig {
  domain: string;
  recordType?: 'A' | 'AAAA' | 'CNAME';
}

export interface DNSRecord {
  domain: string;
  ips: string[];
  timestamp: number;
  recordType: 'A' | 'AAAA' | 'CNAME';
}

export interface DNSCheckResult {
  domain: string;
  timestamp: number;
  hasChanged: boolean;
  previousIPs: string[];
  currentIPs: string[];
  isFirstCheck: boolean;
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