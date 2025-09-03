import { DNSCheckResult } from '../types';
import { BaseNotificationHandler } from './base';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export class TelegramNotificationHandler extends BaseNotificationHandler {
  name = 'Telegram';
  private config: TelegramConfig;
  
  constructor(config: TelegramConfig) {
    super();
    this.config = config;
  }
  
  async notify(results: DNSCheckResult[]): Promise<void> {
    const hijackedResults = this.filterHijackedResults(results);
    
    if (hijackedResults.length === 0) {
      // Only notify when there are hijacked domains
      return;
    }
    
    const message = this.formatMessage(hijackedResults);
    await this.sendTelegramMessage(message);
  }
  
  private async sendTelegramMessage(message: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: this.config.chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send Telegram message: ${error}`);
    }
  }
}