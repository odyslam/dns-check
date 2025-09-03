# DNS Monitor - Cloudflare Worker

A Cloudflare Worker service that monitors DNS records for potential hijacking attempts by checking domains at regular intervals.

## Features

- Monitors multiple domains for DNS changes
- Detects potential DNS hijacking by comparing actual IPs with expected ones
- Modular notification system (Telegram support included)
- Runs automatically every 5 minutes using Cloudflare cron triggers
- Manual check endpoint for on-demand verification

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Domains to Monitor

Edit `wrangler.jsonc` and update the `DNS_MONITOR_CONFIG` variable:

```json
"vars": {
  "DNS_MONITOR_CONFIG": "{\"domains\":[{\"domain\":\"example.com\",\"expectedIPs\":[\"93.184.216.34\"],\"recordType\":\"A\"},{\"domain\":\"yourdomain.com\",\"expectedIPs\":[\"1.2.3.4\"],\"recordType\":\"A\"}]}"
}
```

### 3. Set Up Telegram Notifications (Optional)

```bash
# Set your Telegram bot token
wrangler secret put TELEGRAM_BOT_TOKEN

# Set your Telegram chat ID
wrangler secret put TELEGRAM_CHAT_ID
```

### 4. Deploy

```bash
npm run deploy
```

## Configuration

The DNS monitor accepts configuration through the `DNS_MONITOR_CONFIG` environment variable. Each domain entry should include:

- `domain`: The domain name to monitor
- `expectedIPs`: Array of IP addresses that are considered valid
- `recordType`: DNS record type (A, AAAA, or CNAME)

Example configuration:
```json
{
  "domains": [
    {
      "domain": "example.com",
      "expectedIPs": ["93.184.216.34"],
      "recordType": "A"
    },
    {
      "domain": "google.com", 
      "expectedIPs": [
        "142.250.185.78",
        "142.250.185.110",
        "142.250.185.100"
      ],
      "recordType": "A"
    }
  ]
}
```

## API Endpoints

- `GET /` - Basic service info
- `GET /status` - Service status
- `GET /check` - Manually trigger DNS checks

## Cron Schedule

By default, the worker runs every 5 minutes. You can modify this in `wrangler.jsonc`:

```json
"triggers": {
  "crons": ["*/5 * * * *"]
}
```

## Adding New Notification Handlers

To add a new notification handler:

1. Create a new file in `src/notifications/`
2. Extend the `BaseNotificationHandler` class
3. Implement the `notify` method
4. Add the handler to the main worker file

Example:
```typescript
import { BaseNotificationHandler } from './base';

export class SlackNotificationHandler extends BaseNotificationHandler {
  name = 'Slack';
  
  async notify(results: DNSCheckResult[]): Promise<void> {
    // Implementation
  }
}
```

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Check types
npm run cf-typegen
```