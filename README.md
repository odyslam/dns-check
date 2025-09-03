# DNS Monitor - Cloudflare Worker

A Cloudflare Worker service that monitors DNS records for changes and potential hijacking attempts. Instead of maintaining a list of expected IPs, it tracks DNS changes over time and alerts when changes are detected.

## How It Works

1. Monitors configured domains every 5 minutes
2. Stores DNS records in Cloudflare KV
3. Compares current DNS records with previously stored ones
4. Sends notifications only when DNS records change
5. First-time checks don't trigger alerts (baseline establishment)

## Features

- Monitors multiple domains for DNS changes
- Detects DNS record changes automatically
- No need to maintain expected IP lists
- Modular notification system (Telegram support included)
- Uses Cloudflare KV for persistent storage
- Runs automatically every 5 minutes using cron triggers

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create "DNS_HISTORY"

# Create preview namespace for development
wrangler kv:namespace create "DNS_HISTORY" --preview
```

Update `wrangler.jsonc` with the IDs returned from the above commands:

```jsonc
"kv_namespaces": [
  {
    "binding": "DNS_HISTORY",
    "id": "YOUR_KV_NAMESPACE_ID",
    "preview_id": "YOUR_KV_PREVIEW_ID"
  }
]
```

### 3. Configure Domains to Monitor

Edit `wrangler.jsonc` and update the `DNS_MONITOR_CONFIG` variable:

```json
"vars": {
  "DNS_MONITOR_CONFIG": "{\"domains\":[{\"domain\":\"example.com\"},{\"domain\":\"yourdomain.com\"}]}"
}
```

Or configure individual domains with record types:

```json
"vars": {
  "DNS_MONITOR_CONFIG": "{\"domains\":[{\"domain\":\"example.com\",\"recordType\":\"A\"},{\"domain\":\"example.org\",\"recordType\":\"AAAA\"}]}"
}
```

### 4. Set Up Telegram Notifications (Optional)

```bash
# Set your Telegram bot token
wrangler secret put TELEGRAM_BOT_TOKEN

# Set your Telegram chat ID
wrangler secret put TELEGRAM_CHAT_ID
```

### 5. Deploy

```bash
npm run deploy
```

## Configuration

The DNS monitor accepts configuration through the `DNS_MONITOR_CONFIG` environment variable. Each domain entry can include:

- `domain`: The domain name to monitor (required)
- `recordType`: DNS record type - A, AAAA, or CNAME (optional, defaults to 'A')

### Default DeFi Protocol Monitoring

The service comes pre-configured to monitor major DeFi protocols including:
- Uniswap (app.uniswap.org)
- AAVE (aave.com)
- Curve Finance (curve.fi)
- Lido (lido.fi)
- MakerDAO (makerdao.com)
- Sky Protocol (sky.money)
- Compound (compound.finance)
- SushiSwap (sushi.com)
- PancakeSwap (pancakeswap.finance)
- Balancer (balancer.fi)
- Convex Finance (convex.finance)
- Yearn Finance (yearn.finance)
- Summer.fi (summer.fi)
- 1inch (1inch.io)
- Synthetix (synthetix.io)

Example configuration:
```json
{
  "domains": [
    { "domain": "app.uniswap.org" },
    { "domain": "aave.com" },
    { "domain": "curve.fi", "recordType": "A" }
  ]
}
```

## API Endpoints

- `GET /` - Basic service info
- `GET /status` - Service status
- `GET /check` - Manually trigger DNS checks

## Understanding Alerts

When the service detects DNS changes, you'll receive an alert showing:
- **Domain**: The affected domain
- **Previous IPs**: The IPs from the last check
- **Current IPs**: The newly detected IPs
- **Timestamp**: When the change was detected

Example alert:
```
🚨 DNS Changes Detected!

Domain: example.com
Previous IPs: 93.184.216.34
Current IPs: 192.0.2.1

Time: 2024-01-01T12:00:00.000Z

⚠️ Verify these changes are legitimate!
```

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
    const changedResults = this.filterChangedResults(results);
    if (changedResults.length === 0) return;
    
    const message = this.formatMessage(changedResults);
    // Send to Slack
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

## Important Notes

- First checks for new domains won't trigger alerts (establishing baseline)
- DNS changes can be legitimate (CDN updates, load balancing changes)
- Always verify DNS changes are authorized before taking action
- The service uses Cloudflare's DNS over HTTPS for resolution