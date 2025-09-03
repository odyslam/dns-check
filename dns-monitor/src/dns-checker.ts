import { DomainConfig, DNSCheckResult } from './types';

export class DNSChecker {
  private dohProviders = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
  ];

  async checkDomain(config: DomainConfig): Promise<DNSCheckResult> {
    const timestamp = Date.now();
    
    try {
      const actualIPs = await this.resolveDomain(
        config.domain, 
        config.recordType || 'A'
      );
      
      const isHijacked = !this.areIPsMatching(actualIPs, config.expectedIPs);
      
      return {
        domain: config.domain,
        timestamp,
        isHijacked,
        expectedIPs: config.expectedIPs,
        actualIPs,
      };
    } catch (error) {
      return {
        domain: config.domain,
        timestamp,
        isHijacked: true,
        expectedIPs: config.expectedIPs,
        actualIPs: [],
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

  private areIPsMatching(actualIPs: string[], expectedIPs: string[]): boolean {
    if (actualIPs.length === 0) return false;
    
    // Check if all actual IPs are in the expected list
    return actualIPs.every(ip => expectedIPs.includes(ip));
  }
}