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

export interface IPAnalysis {
  ip: string;
  geolocation?: {
    country?: string;
    city?: string;
    region?: string;
    lat?: number;
    lon?: number;
  };
  asn?: {
    number?: number;
    name?: string;
    organization?: string;
  };
  reputation?: {
    isClean: boolean;
    isMalicious?: boolean;
    threatScore?: number;
    categories?: string[];
    source?: string;
  };
  reverseDns?: string;
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
  previousIPAnalysis?: IPAnalysis[];
  currentIPAnalysis?: IPAnalysis[];
  riskAssessment?: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommendation: string;
  };
}

export interface NotificationHandler {
  name: string;
  notify(results: DNSCheckResult[]): Promise<void>;
}

export interface Config {
  domains: DomainConfig[];
  notificationHandlers: NotificationHandler[];
}