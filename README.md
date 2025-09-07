# DNS Monitor - Cloudflare Worker

A Cloudflare Worker service that monitors DNS records for changes and potential hijacking attempts. Instead of maintaining a list of expected IPs, it tracks DNS changes over time and alerts when changes are detected.

## How It Works

1. Monitors configured domains every minute via cron trigger
2. Queries multiple DNS resolvers (Cloudflare, Google, Quad9) in parallel
3. Stores DNS records in Cloudflare KV for persistence
4. Compares current DNS records with previously stored ones
5. Detects discrepancies between resolvers (potential hijacking)
6. Sends notifications only when DNS records change
7. First-time checks establish baseline without triggering alerts
8. Bypasses DNS caching with cache-busting parameters

## Features

- Monitors multiple domains for DNS changes
- Detects DNS record changes automatically
- **Risk Assessment**: Analyzes changes to determine threat level
- **IP Intelligence**: Geolocation, ASN, and reputation checking
- **Malicious IP Detection**: Identifies known bad actors and suspicious hosts
- No need to maintain expected IP lists
- Modular notification system (Telegram support included)
- Uses Cloudflare KV for persistent storage
- Runs automatically every minute using cron triggers
- Multi-resolver queries (Cloudflare, Google, Quad9) for hijack detection
- Cache bypassing to ensure fresh DNS results
- Support for NS (nameserver) record monitoring

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create KV Namespace

```bash
# Create KV namespace
wrangler kv:namespace create "DNS_HISTORY"
```

Update `wrangler.jsonc` with the ID returned from the above command:

```jsonc
"kv_namespaces": [
  {
    "binding": "DNS_HISTORY",
    "id": "YOUR_KV_NAMESPACE_ID"
  }
]
```

### 3. Configure Domains to Monitor

Edit the `dns-monitor.toml` file to add or modify domains:

```toml
[[domains]]
name = "My Website"
domain = "example.com"
record_type = "A"  # Options: A, AAAA, CNAME, NS
category = "personal"

[[domains]]
name = "Another Site"
domain = "example.org"
record_type = "AAAA"
category = "business"
```

The TOML file provides an easy-to-read format for managing your monitored domains. Each domain entry supports:
- `name`: Friendly name for the domain (optional)
- `domain`: The domain to monitor (required)
- `record_type`: DNS record type - A, AAAA, CNAME, or NS (optional, defaults to 'A')
- `category`: Category for organization (optional)

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

The DNS monitor is configured through the `dns-monitor.toml` file. Simply edit this file to add, remove, or modify domains to monitor.

### Configuration File Format

The TOML configuration file supports the following structure:

```toml
[[domains]]
name = "Service Name"        # Optional friendly name
domain = "example.com"        # Required domain to monitor
record_type = "A"            # Optional: A, AAAA, CNAME, or NS (default: A)
category = "category"         # Optional category for organization
```

### Default DeFi Protocol Monitoring

The `dns-monitor.toml` file comes pre-configured to monitor major DeFi protocols including:
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

To add your own domains, simply edit the `dns-monitor.toml` file and add new entries following the same format.

## API Endpoints

- `GET /` - Basic service info
- `GET /status` - Service status
- `GET /check` - Manually trigger DNS checks

## Understanding Alerts

The service only sends alerts when it detects:
1. **DNS Changes**: IPs have changed from the last check
2. **Resolver Discrepancies**: Different DNS providers return different results (potential hijacking)

### Risk Levels
- 🟢 **LOW**: Minor infrastructure changes, likely routine
- 🟡 **MEDIUM**: Notable changes that should be verified
- 🟠 **HIGH**: Suspicious changes requiring immediate investigation
- 🔴 **CRITICAL**: Strong indicators of DNS hijacking, immediate action required

### Alert Information Includes
- **Risk Assessment**: Threat level with specific factors and recommendations
- **Domain**: The affected domain (with friendly name if configured)
- **IP Analysis**:
  - 📍 Geographic location (country, city)
  - 🏢 Hosting provider (ASN organization)
  - ✅/⚠️ Reputation status
  - 🔗 Reverse DNS records
- **Previous vs Current IPs**: Complete comparison with metadata
- **Resolver Results**: Individual results from each DNS provider (if discrepancy detected)
- **Timestamp**: When the change was detected

Example alerts:

**Enhanced DNS Change Alert:**
```
🚨 DNS Changes/Discrepancies Detected!

🟠 Risk Level: HIGH

Domain: example.com
Status: DNS records changed
Previous IPs: 93.184.216.34
Current IPs: 192.0.2.1

📊 Previous IP Analysis:
  • 93.184.216.34:
    📍 Location: Los Angeles, United States
    🏢 Provider: Example Inc.
    🔗 Reverse DNS: example.com

📊 Current IP Analysis:
  • 192.0.2.1:
    📍 Location: Moscow, Russia
    🏢 Provider: Unknown Hosting
    ⚠️ MALICIOUS IP DETECTED!
    🏷️ Categories: Known bulletproof hosting

🔍 Risk Assessment:
  🚨 1 IP(s) flagged as malicious
  📍 Geographic change: moved to Russia
  ⚠️ Moved to high-risk countries: Russia
  🏢 Hosting provider changed to: Unknown Hosting

💡 Recommendation:
⚠️ HIGH RISK: Significant suspicious indicators detected. Investigate immediately.

Time: 2024-01-01T12:00:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Please review the risk assessment and verify if these changes are legitimate!
```

**DNS Hijacking Alert:**
```
🚨 DNS Changes/Discrepancies Detected!

Domain: example.com
⚠️ ALERT: Resolver Discrepancy Detected!
Different DNS resolvers are returning different results:
  • Cloudflare: 93.184.216.34
  • Google: 192.0.2.1
  • Quad9: 93.184.216.34
This could indicate a DNS hijacking attempt!
Time: 2024-01-01T12:00:00.000Z

⚠️ Verify these changes are legitimate!
```

## Cron Schedule

By default, the worker runs every minute. You can modify this in `wrangler.jsonc`:

```json
"triggers": {
  "crons": ["* * * * *"]
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

# Run tests (requires npm, not bun)
npm test

# Check types
npm run cf-typegen
```

## Important Notes

- **Baseline Establishment**: First checks for new domains won't trigger alerts - the service needs to establish a baseline first
- **Legitimate Changes**: DNS changes can be legitimate (CDN updates, load balancing, failover)
- **Always Verify**: Confirm DNS changes are authorized before taking action
- **Multi-Resolver Verification**: Queries 2 DNS providers (Cloudflare, Google) for verification
- **DNS-over-HTTPS**: Uses DoH protocol for secure DNS resolution
- **Cache Bypassing**: Adds timestamp parameters to ensure fresh results
- **Testing**: Run tests with `npm test` (uses Vitest with Cloudflare Workers runtime)

## Cloudflare Worker Limitations

Due to Cloudflare Worker subrequest limits (50 per request):
- **Manual `/check` endpoint**: Runs in "lite mode" - checks only 5 domains without IP analysis
- **Scheduled cron jobs**: Can handle all domains but may skip some IP analysis features
- **Production optimizations**:
  - Reduced from 3 to 2 DNS resolvers
  - IP analysis only runs on changed domains
  - Limited to analyzing first 2 IPs per domain
  - Reverse DNS lookups disabled in bulk operations