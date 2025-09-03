import { DomainConfig, DNSCheckResult, DNSRecord } from './types';

export class DNSChecker {
  private dohProviders = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
  ];
  
  constructor(private kvStore: KVNamespace) {}

  async checkDomain(config: DomainConfig): Promise<DNSCheckResult> {
    const timestamp = Date.now();
    const recordType = config.recordType || 'A';
    
    try {
      // Get current IPs
      const currentIPs = await this.resolveDomain(config.domain, recordType);
      
      // Get previous record from KV
      const kvKey = `dns:${config.domain}:${recordType}`;
      const previousRecordStr = await this.kvStore.get(kvKey);
      const previousRecord: DNSRecord | null = previousRecordStr 
        ? JSON.parse(previousRecordStr) 
        : null;
      
      // Determine if IPs have changed
      const hasChanged = previousRecord 
        ? !this.areIPsMatching(currentIPs, previousRecord.ips)
        : false;
      
      // Store current state in KV
      const newRecord: DNSRecord = {
        domain: config.domain,
        ips: currentIPs,
        timestamp,
        recordType,
      };
      await this.kvStore.put(kvKey, JSON.stringify(newRecord));
      
      return {
        domain: config.domain,
        timestamp,
        hasChanged,
        previousIPs: previousRecord?.ips || [],
        currentIPs,
        isFirstCheck: !previousRecord,
      };
    } catch (error) {
      return {
        domain: config.domain,
        timestamp,
        hasChanged: true,
        previousIPs: [],
        currentIPs: [],
        isFirstCheck: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkDomains(configs: DomainConfig[]): Promise<DNSCheckResult[]> {
    const checkPromises = configs.map(config => this.checkDomain(config));
    return Promise.all(checkPromises);
  }

  private async resolveDomain(
    domain: string, 
    recordType: 'A' | 'AAAA' | 'CNAME'
  ): Promise<string[]> {
    const provider = this.dohProviders[0];
    const url = `${provider}?name=${domain}&type=${recordType}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dns-json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`DNS query failed: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    if (data.Status !== 0) {
      throw new Error(`DNS query returned status: ${data.Status}`);
    }
    
    const ips: string[] = [];
    
    if (data.Answer) {
      for (const answer of data.Answer) {
        if (answer.type === 1 || answer.type === 28) { // A or AAAA records
          ips.push(answer.data);
        } else if (answer.type === 5 && recordType === 'CNAME') { // CNAME
          ips.push(answer.data);
        }
      }
    }
    
    return ips;
  }

  private areIPsMatching(ips1: string[], ips2: string[]): boolean {
    if (ips1.length !== ips2.length) return false;
    
    const sorted1 = [...ips1].sort();
    const sorted2 = [...ips2].sort();
    
    return sorted1.every((ip, index) => ip === sorted2[index]);
  }
}