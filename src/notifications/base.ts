import { DNSCheckResult, NotificationHandler } from '../types';

export abstract class BaseNotificationHandler implements NotificationHandler {
  abstract name: string;
  
  abstract notify(results: DNSCheckResult[]): Promise<void>;
  
  protected filterHijackedResults(results: DNSCheckResult[]): DNSCheckResult[] {
    return results.filter(result => result.isHijacked);
  }
  
  protected formatMessage(hijackedResults: DNSCheckResult[]): string {
    if (hijackedResults.length === 0) {
      return '✅ All domains are resolving correctly.';
    }
    
    let message = `🚨 DNS Hijacking Detected!\n\n`;
    
    for (const result of hijackedResults) {
      message += `Domain: ${result.domain}\n`;
      message += `Expected IPs: ${result.expectedIPs.join(', ')}\n`;
      message += `Actual IPs: ${result.actualIPs.join(', ')}\n`;
      
      if (result.error) {
        message += `Error: ${result.error}\n`;
      }
      
      message += `Time: ${new Date(result.timestamp).toISOString()}\n`;
      message += '\n';
    }
    
    return message;
  }
}