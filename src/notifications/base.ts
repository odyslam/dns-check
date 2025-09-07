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
      // Risk level indicator
      if (result.riskAssessment) {
        const riskEmoji = {
          'critical': '🔴',
          'high': '🟠',
          'medium': '🟡',
          'low': '🟢'
        }[result.riskAssessment.level];
        message += `${riskEmoji} <b>Risk Level: ${result.riskAssessment.level.toUpperCase()}</b>\n`;
      }
      
      message += `<b>Domain:</b> ${result.domain}\n`;
      
      if (result.hasChanged && !result.isFirstCheck) {
        message += `<b>Status:</b> DNS records changed\n`;
        message += `<b>Previous IPs:</b> ${result.previousIPs.join(', ') || 'None'}\n`;
        message += `<b>Current IPs:</b> ${result.currentIPs.join(', ') || 'None'}\n`;
        
        // Add IP analysis details
        if (result.previousIPAnalysis && result.previousIPAnalysis.length > 0) {
          message += `\n<b>📊 Previous IP Analysis:</b>\n`;
          for (const analysis of result.previousIPAnalysis) {
            message += `  • ${analysis.ip}:\n`;
            if (analysis.geolocation) {
              message += `    📍 Location: ${analysis.geolocation.city || 'Unknown'}, ${analysis.geolocation.country || 'Unknown'}\n`;
            }
            if (analysis.asn) {
              message += `    🏢 Provider: ${analysis.asn.organization || 'Unknown'}\n`;
            }
            if (analysis.reverseDns) {
              message += `    🔗 Reverse DNS: ${analysis.reverseDns}\n`;
            }
          }
        }
        
        if (result.currentIPAnalysis && result.currentIPAnalysis.length > 0) {
          message += `\n<b>📊 Current IP Analysis:</b>\n`;
          for (const analysis of result.currentIPAnalysis) {
            message += `  • ${analysis.ip}:\n`;
            if (analysis.geolocation) {
              message += `    📍 Location: ${analysis.geolocation.city || 'Unknown'}, ${analysis.geolocation.country || 'Unknown'}\n`;
            }
            if (analysis.asn) {
              message += `    🏢 Provider: ${analysis.asn.organization || analysis.asn.name || 'Unknown'}\n`;
            }
            if (analysis.reputation) {
              if (analysis.reputation.isMalicious) {
                message += `    ⚠️ MALICIOUS IP DETECTED!\n`;
                if (analysis.reputation.categories && analysis.reputation.categories.length > 0) {
                  message += `    🏷️ Categories: ${analysis.reputation.categories.join(', ')}\n`;
                }
              } else if (analysis.reputation.isClean) {
                message += `    ✅ Reputation: Clean\n`;
              }
            }
            if (analysis.reverseDns) {
              message += `    🔗 Reverse DNS: ${analysis.reverseDns}\n`;
            }
          }
        }
        
        // Add risk assessment details
        if (result.riskAssessment) {
          message += `\n<b>🔍 Risk Assessment:</b>\n`;
          for (const factor of result.riskAssessment.factors) {
            message += `  ${factor}\n`;
          }
          message += `\n<b>💡 Recommendation:</b>\n${result.riskAssessment.recommendation}\n`;
        }
      }
      
      if (result.resolverDiscrepancy) {
        message += `\n<b>⚠️ ALERT: Resolver Discrepancy Detected!</b>\n`;
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
      message += '\n' + '━'.repeat(40) + '\n\n';
    }
    
    message += `⚠️ <b>Please review the risk assessment and verify if these changes are legitimate!</b>`;
    
    return message;
  }
}