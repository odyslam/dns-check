import { DNSChecker } from './dns-checker';
import { loadConfig } from './config';
import { TelegramNotificationHandler } from './notifications/telegram';
import { NotificationHandler, DNSCheckResult } from './types';
import configToml from '../dns-monitor.toml';

interface Env {
  DNS_MONITOR_CONFIG?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DNS_HISTORY: KVNamespace;
}

async function performDNSCheck(env: Env, options?: { lite?: boolean }): Promise<DNSCheckResult[]> {
  const config = loadConfig(env, configToml);
  
  // In lite mode, check fewer domains and disable IP analysis
  const domainsToCheck = options?.lite 
    ? config.domains.slice(0, 5) // Only check first 5 domains in lite mode
    : config.domains;
  
  const checker = new DNSChecker(env.DNS_HISTORY, {
    enableIpAnalysis: !options?.lite // Disable IP analysis in lite mode
  });
  
  // Create notification handlers
  const notificationHandlers: NotificationHandler[] = [];
  
  // Add Telegram handler if configured
  if (config.telegram && config.telegram.botToken !== 'YOUR_BOT_TOKEN') {
    notificationHandlers.push(
      new TelegramNotificationHandler({
        botToken: env.TELEGRAM_BOT_TOKEN || config.telegram.botToken,
        chatId: env.TELEGRAM_CHAT_ID || config.telegram.chatId,
      })
    );
  }
  
  // Perform DNS checks
  const results = await checker.checkDomains(domainsToCheck);
  
  // Send notifications
  for (const handler of notificationHandlers) {
    try {
      await handler.notify(results);
    } catch (error) {
      console.error(`Notification handler ${handler.name} failed:`, error);
    }
  }
  
  return results;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/check':
        // Manual trigger endpoint - use lite mode to avoid timeouts
        const results = await performDNSCheck(env, { lite: true });
        return new Response(JSON.stringify({
          note: 'Running in lite mode (5 domains, no IP analysis) to avoid timeouts',
          results: results,
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
        
      case '/status':
        return new Response(JSON.stringify({
          status: 'running',
          version: '1.0.0',
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
        
      default:
        return new Response('DNS Monitor Service', {
          headers: { 'Content-Type': 'text/plain' },
        });
    }
  },
  
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // This will be triggered by cron
    ctx.waitUntil(performDNSCheck(env));
  },
} satisfies ExportedHandler<Env>;
