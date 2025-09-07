import { DomainConfig, DNSCheckResult, DNSRecord } from './types';

export class DNSChecker {
  private dohProviders = [
    { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
    { name: 'Google', url: 'https://dns.google/resolve' },
    { name: 'Quad9', url: 'https://dns.quad9.net:5053/dns-query' },
  ];
  
  constructor(private kvStore: KVNamespace) {}

  async checkDomain(config: DomainConfig): Promise<DNSCheckResult> {
    const timestamp = Date.now();
    const recordType = config.recordType || 'A';
    
    try {
      // Get current IPs from multiple resolvers
      const resolverResults = await this.resolveDomainMultiple(config.domain, recordType);
      
      // Check for resolver discrepancies
      const resolverDiscrepancy = this.checkResolverDiscrepancy(resolverResults);
      
      // Use the most common result or first resolver if all differ
      const currentIPs = this.getMostCommonResult(resolverResults);
      
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
        resolverDiscrepancy,
        resolverResults,
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

  private async resolveDomainMultiple(
    domain: string,
    recordType: 'A' | 'AAAA' | 'CNAME' | 'NS'
  ): Promise<{ [resolver: string]: string[] }> {
    const results: { [resolver: string]: string[] } = {};
    
    // Query all resolvers in parallel
    const promises = this.dohProviders.map(async (provider) => {
      try {
        const ips = await this.resolveDomain(domain, recordType, provider.url);
        results[provider.name] = ips;
      } catch (error) {
        console.error(`Failed to query ${provider.name}:`, error);
        results[provider.name] = [];
      }
    });
    
    await Promise.all(promises);
    return results;
  }
  
  private async resolveDomain(
    domain: string, 
    recordType: 'A' | 'AAAA' | 'CNAME' | 'NS',
    providerUrl: string
  ): Promise<string[]> {
    // Add cache-busting parameter
    const cacheBuster = `cb=${Date.now()}`;
    const url = `${providerUrl}?name=${domain}&type=${recordType}&${cacheBuster}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dns-json',
        'Cache-Control': 'no-cache, no-store',
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
        } else if (answer.type === 2 && recordType === 'NS') { // NS records
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
  
  private checkResolverDiscrepancy(resolverResults: { [resolver: string]: string[] }): boolean {
    const resolvers = Object.keys(resolverResults);
    if (resolvers.length <= 1) return false;
    
    // Get non-empty results
    const validResults = resolvers
      .map(r => resolverResults[r])
      .filter(ips => ips.length > 0);
    
    if (validResults.length <= 1) return false;
    
    // Compare all results
    for (let i = 0; i < validResults.length - 1; i++) {
      if (!this.areIPsMatching(validResults[i], validResults[i + 1])) {
        return true;
      }
    }
    
    return false;
  }
  
  private getMostCommonResult(resolverResults: { [resolver: string]: string[] }): string[] {
    const results = Object.values(resolverResults).filter(ips => ips.length > 0);
    
    if (results.length === 0) return [];
    if (results.length === 1) return results[0];
    
    // Find the most common result
    const resultCounts = new Map<string, { count: number; ips: string[] }>();
    
    for (const ips of results) {
      const key = [...ips].sort().join(',');
      const existing = resultCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        resultCounts.set(key, { count: 1, ips });
      }
    }
    
    // Return the most common result
    let maxCount = 0;
    let mostCommon: string[] = results[0];
    
    for (const { count, ips } of resultCounts.values()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = ips;
      }
    }
    
    return mostCommon;
  }
}