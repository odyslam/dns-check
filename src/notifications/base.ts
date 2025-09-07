import { DNSCheckResult, NotificationHandler } from '../types';

export abstract class BaseNotificationHandler implements NotificationHandler {
  abstract name: string;
  
  abstract notify(results: DNSCheckResult[]): Promise<void>;
  
  protected filterChangedResults(results: DNSCheckResult[]): DNSCheckResult[] {
    return results.filter(result => 
      (result.hasChanged && !result.isFirstCheck) || result.resolverDiscrepancy
    );
  }
  
  protected formatMessage(changedResults: DNSCheckResult[]): string {
    if (changedResults.length === 0) {
      return '✅ All domains are resolving to their expected IPs.';
    }
    
    let message = `🚨 DNS Changes/Discrepancies Detected!\n\n`;
    
    for (const result of changedResults) {
      message += `<b>Domain:</b> ${result.domain}\n`;
      
      if (result.hasChanged && !result.isFirstCheck) {
        message += `<b>Status:</b> DNS records changed\n`;
        message += `<b>Previous IPs:</b> ${result.previousIPs.join(', ') || 'None'}\n`;
        message += `<b>Current IPs:</b> ${result.currentIPs.join(', ') || 'None'}\n`;
      }
      
      if (result.resolverDiscrepancy) {
        message += `<b>⚠️ ALERT: Resolver Discrepancy Detected!</b>\n`;
        message += `Different DNS resolvers are returning different results:\n`;
        
        if (result.resolverResults) {
          for (const [resolver, ips] of Object.entries(result.resolverResults)) {
            message += `  • ${resolver}: ${ips.join(', ') || 'No results'}\n`;
          }
        }
        
        message += `This could indicate a DNS hijacking attempt!\n`;
      }
      
      if (result.error) {
        message += `<b>Error:</b> ${result.error}\n`;
      }
      
      message += `<b>Time:</b> ${new Date(result.timestamp).toISOString()}\n`;
      message += '\n';
    }
    
    message += `⚠️ <b>Verify these changes are legitimate!</b>`;
    
    return message;
  }
}