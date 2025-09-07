import { IPAnalysis } from './types';

export class IPAnalyzer {
  // Free IP geolocation and info services
  private geoProviders = [
    { 
      name: 'ipapi', 
      url: (ip: string) => `https://ipapi.co/${ip}/json/`,
      rateLimit: 1000 // per day without API key
    },
    {
      name: 'ip-api',
      url: (ip: string) => `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,as,org,isp,query`,
      rateLimit: 45 // per minute
    }
  ];

  // AbuseIPDB for reputation (requires API key but has free tier)
  private reputationProviders = [
    {
      name: 'cloudflare-radar',
      url: (ip: string) => `https://radar.cloudflare.com/api/v1/entities/ip/${ip}`,
    }
  ];

  async analyzeIP(ip: string, options?: { skipGeo?: boolean; skipReputation?: boolean; skipReverseDns?: boolean }): Promise<IPAnalysis> {
    const analysis: IPAnalysis = { ip };

    // Skip analysis for private/local IPs
    if (this.isPrivateIP(ip)) {
      analysis.geolocation = { country: 'Private IP', city: 'Local Network' };
      analysis.reputation = { isClean: true };
      return analysis;
    }

    // Get geolocation and ASN info (skip if disabled to save subrequests)
    if (!options?.skipGeo) {
      try {
        const geoData = await this.getGeolocation(ip);
        if (geoData) {
          analysis.geolocation = geoData.geolocation;
          analysis.asn = geoData.asn;
        }
      } catch (error) {
        console.error(`Failed to get geolocation for ${ip}:`, error);
      }
    }

    // Get reputation info (skip if disabled to save subrequests)
    if (!options?.skipReputation) {
      try {
        analysis.reputation = await this.getReputation(ip);
      } catch (error) {
        console.error(`Failed to get reputation for ${ip}:`, error);
      }
    }

    // Get reverse DNS (skip if disabled to save subrequests)
    if (!options?.skipReverseDns) {
      try {
        analysis.reverseDns = await this.getReverseDns(ip);
      } catch (error) {
        console.error(`Failed to get reverse DNS for ${ip}:`, error);
      }
    }

    return analysis;
  }

  async analyzeIPs(ips: string[], options?: { skipGeo?: boolean; skipReputation?: boolean; skipReverseDns?: boolean }): Promise<IPAnalysis[]> {
    // For production, only do basic analysis to avoid subrequest limits
    const promises = ips.map(ip => this.analyzeIP(ip, {
      skipGeo: options?.skipGeo,
      skipReputation: options?.skipReputation,
      skipReverseDns: true, // Always skip reverse DNS in bulk to save subrequests
    }));
    return Promise.all(promises);
  }

  private async getGeolocation(ip: string): Promise<Partial<IPAnalysis> | null> {
    // Try ip-api first (no HTTPS but more generous rate limit)
    try {
      const response = await fetch(this.geoProviders[1].url(ip));
      if (response.ok) {
        const data = await response.json() as any;
        if (data.status === 'success') {
          return {
            geolocation: {
              country: data.country,
              city: data.city,
              region: data.regionName,
              lat: data.lat,
              lon: data.lon,
            },
            asn: {
              name: data.as?.split(' ')[0],
              organization: data.org || data.isp,
            }
          };
        }
      }
    } catch (error) {
      console.error('ip-api failed:', error);
    }

    // Fallback to ipapi.co
    try {
      const response = await fetch(this.geoProviders[0].url(ip));
      if (response.ok) {
        const data = await response.json() as any;
        return {
          geolocation: {
            country: data.country_name,
            city: data.city,
            region: data.region,
            lat: data.latitude,
            lon: data.longitude,
          },
          asn: {
            number: data.asn,
            organization: data.org,
          }
        };
      }
    } catch (error) {
      console.error('ipapi.co failed:', error);
    }

    return null;
  }

  private async getReputation(ip: string): Promise<IPAnalysis['reputation']> {
    // Basic reputation check using Cloudflare Radar (public data)
    try {
      const response = await fetch(this.reputationProviders[0].url(ip));
      if (response.ok) {
        const data = await response.json() as any;
        
        // Analyze the response for threat indicators
        const isMalicious = data.result?.threat_score > 50;
        
        return {
          isClean: !isMalicious,
          isMalicious,
          threatScore: data.result?.threat_score,
          categories: data.result?.categories || [],
          source: 'cloudflare-radar'
        };
      }
    } catch (error) {
      console.error('Cloudflare Radar check failed:', error);
    }

    // Check against known bad IP ranges
    const badRanges = this.checkKnownBadRanges(ip);
    if (badRanges.length > 0) {
      return {
        isClean: false,
        isMalicious: true,
        categories: badRanges,
        source: 'local-checks'
      };
    }

    // Default to unknown/clean
    return {
      isClean: true,
      isMalicious: false,
      source: 'default'
    };
  }

  private async getReverseDns(ip: string): Promise<string | undefined> {
    // Use DNS over HTTPS to get PTR record
    try {
      const reversedIP = ip.split('.').reverse().join('.');
      const url = `https://cloudflare-dns.com/dns-query?name=${reversedIP}.in-addr.arpa&type=PTR`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/dns-json',
        },
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.Answer && data.Answer.length > 0) {
          return data.Answer[0].data;
        }
      }
    } catch (error) {
      console.error('Reverse DNS lookup failed:', error);
    }
    
    return undefined;
  }

  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    
    // Check for private IP ranges
    return (
      // 10.0.0.0/8
      parts[0] === 10 ||
      // 172.16.0.0/12
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      // 192.168.0.0/16
      (parts[0] === 192 && parts[1] === 168) ||
      // 127.0.0.0/8 (loopback)
      parts[0] === 127
    );
  }

  private checkKnownBadRanges(ip: string): string[] {
    const categories: string[] = [];
    
    // Known suspicious hosting providers often used for attacks
    const suspiciousASNs = [
      { range: '45.142.120.0/22', name: 'Known bulletproof hosting' },
      { range: '185.220.100.0/22', name: 'TOR exit nodes' },
      { range: '104.244.72.0/21', name: 'Common phishing host' },
    ];
    
    // This is a simplified check - in production you'd use proper CIDR matching
    for (const asn of suspiciousASNs) {
      if (this.isIPInRange(ip, asn.range)) {
        categories.push(asn.name);
      }
    }
    
    return categories;
  }

  private isIPInRange(ip: string, cidr: string): boolean {
    // Simplified check - in production use proper CIDR library
    const [range] = cidr.split('/');
    const rangeParts = range.split('.').slice(0, 2).join('.');
    const ipParts = ip.split('.').slice(0, 2).join('.');
    return rangeParts === ipParts;
  }

  assessRisk(previous: IPAnalysis[], current: IPAnalysis[]): {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    recommendation: string;
  } {
    const factors: string[] = [];
    let riskScore = 0;

    // Check for malicious IPs
    const maliciousIPs = current.filter(a => a.reputation?.isMalicious);
    if (maliciousIPs.length > 0) {
      factors.push(`🚨 ${maliciousIPs.length} IP(s) flagged as malicious`);
      riskScore += 50 * maliciousIPs.length;
    }

    // Check for country changes
    const prevCountries = new Set(previous.map(a => a.geolocation?.country).filter(Boolean));
    const currCountries = new Set(current.map(a => a.geolocation?.country).filter(Boolean));
    const newCountries = [...currCountries].filter(c => !prevCountries.has(c));
    
    if (newCountries.length > 0) {
      factors.push(`📍 Geographic change: moved to ${newCountries.join(', ')}`);
      riskScore += 20;
      
      // Higher risk for certain countries
      const highRiskCountries = ['Russia', 'China', 'North Korea', 'Iran'];
      const riskyCountries = newCountries.filter(c => highRiskCountries.includes(c!));
      if (riskyCountries.length > 0) {
        factors.push(`⚠️ Moved to high-risk countries: ${riskyCountries.join(', ')}`);
        riskScore += 30;
      }
    }

    // Check for ASN changes
    const prevASNs = new Set(previous.map(a => a.asn?.organization).filter(Boolean));
    const currASNs = new Set(current.map(a => a.asn?.organization).filter(Boolean));
    const newASNs = [...currASNs].filter(a => !prevASNs.has(a));
    
    if (newASNs.length > 0) {
      factors.push(`🏢 Hosting provider changed to: ${newASNs.join(', ')}`);
      riskScore += 15;
    }

    // Check for missing reverse DNS
    const missingReverseDNS = current.filter(a => !a.reverseDns);
    if (missingReverseDNS.length === current.length && current.length > 0) {
      factors.push('🔍 No reverse DNS configured (suspicious)');
      riskScore += 25;
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high' | 'critical';
    let recommendation: string;
    
    if (riskScore >= 80) {
      level = 'critical';
      recommendation = '🚨 IMMEDIATE ACTION REQUIRED: This appears to be a DNS hijacking. Verify immediately and consider blocking access.';
    } else if (riskScore >= 50) {
      level = 'high';
      recommendation = '⚠️ HIGH RISK: Significant suspicious indicators detected. Investigate immediately.';
    } else if (riskScore >= 25) {
      level = 'medium';
      recommendation = '⚡ MEDIUM RISK: Some concerning changes detected. Verify if these changes were authorized.';
    } else {
      level = 'low';
      recommendation = '✅ LOW RISK: Changes appear to be routine. Still worth verifying if expected.';
    }

    if (factors.length === 0) {
      factors.push('Minor infrastructure change detected');
    }

    return { level, factors, recommendation };
  }
}