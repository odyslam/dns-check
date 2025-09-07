export interface DomainConfig {
  name?: string;
  domain: string;
  recordType?: 'A' | 'AAAA' | 'CNAME' | 'NS';
  category?: string;
}

export interface DNSRecord {
  domain: string;
  ips: string[];
  timestamp: number;
  recordType: 'A' | 'AAAA' | 'CNAME' | 'NS';
}

export interface DNSCheckResult {
  domain: string;
  timestamp: number;
  hasChanged: boolean;
  previousIPs: string[];
  currentIPs: string[];
  isFirstCheck: boolean;
  error?: string;
  resolverDiscrepancy?: boolean;
  resolverResults?: { [resolver: string]: string[] };
}

export interface NotificationHandler {
  name: string;
  notify(results: DNSCheckResult[]): Promise<void>;
}

export interface Config {
  domains: DomainConfig[];
  notificationHandlers: NotificationHandler[];
}