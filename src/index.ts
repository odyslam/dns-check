import { DNSChecker } from './dns-checker';
import { loadConfig } from './config';
import { TelegramNotificationHandler } from './notifications/telegram';
import { NotificationHandler, DNSCheckResult } from './types';

interface Env {
  DNS_MONITOR_CONFIG?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DNS_HISTORY: KVNamespace;
}

async function performDNSCheck(env: Env): Promise<DNSCheckResult[]> {
  const config = loadConfig(env);
  const checker = new DNSChecker(env.DNS_HISTORY);
  
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
  const results = await checker.checkDomains(config.domains);
  
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
        // Manual trigger endpoint
        const results = await performDNSCheck(env);
        return new Response(JSON.stringify(results, null, 2), {
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
