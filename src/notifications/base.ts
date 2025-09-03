import { DNSCheckResult, NotificationHandler } from '../types';

export abstract class BaseNotificationHandler implements NotificationHandler {
  abstract name: string;
  
  abstract notify(results: DNSCheckResult[]): Promise<void>;
  
  protected filterChangedResults(results: DNSCheckResult[]): DNSCheckResult[] {
    return results.filter(result => result.hasChanged && !result.isFirstCheck);
  }
  
  protected formatMessage(changedResults: DNSCheckResult[]): string {
    if (changedResults.length === 0) {
      return '✅ All domains are resolving to their expected IPs.';
    }
    
    let message = `🚨 DNS Changes Detected!\n\n`;
    
    for (const result of changedResults) {
      message += `Domain: ${result.domain}\n`;
      message += `Previous IPs: ${result.previousIPs.join(', ') || 'None'}\n`;
      message += `Current IPs: ${result.currentIPs.join(', ') || 'None'}\n`;
      
      if (result.error) {
        message += `Error: ${result.error}\n`;
      }
      
      message += `Time: ${new Date(result.timestamp).toISOString()}\n`;
      message += '\n';
    }
    
    message += `⚠️ Verify these changes are legitimate!`;
    
    return message;
  }
}