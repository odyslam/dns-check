# DNS Monitor - Architecture Documentation

## Overview
A Cloudflare Worker service that monitors DNS records for changes and potential hijacking attempts. It tracks DNS changes over time rather than maintaining expected IP lists, sending alerts only when changes are detected.

## Architecture Components

### Core Files

#### `src/index.ts`
- **Purpose**: Main entry point and request handler
- **Key Components**:
  - `Env` interface: Defines environment variables (lines 6-11)
  - `performDNSCheck()`: Orchestrates the DNS checking workflow (lines 13-43)
  - HTTP endpoints:
    - `/check`: Manual DNS check trigger (lines 50-55)
    - `/status`: Service health check (lines 57-63)
    - `/`: Default info endpoint (lines 65-68)
  - `scheduled()`: Cron trigger handler (lines 72-74)

#### `src/dns-checker.ts`
- **Purpose**: Core DNS resolution and comparison logic
- **Key Components**:
  - `DNSChecker` class: Main DNS checking logic (lines 3-201)
  - DoH providers: Cloudflare, Google, Quad9 (lines 4-8)
  - `checkDomain()`: Single domain check with multi-resolver support (lines 12-68)
  - `resolveDomainMultiple()`: Queries all resolvers in parallel (lines 75-94)
  - `resolveDomain()`: DNS-over-HTTPS query with cache busting (lines 96-137)
  - `checkResolverDiscrepancy()`: Detects DNS hijacking attempts (lines 148-167)
  - `getMostCommonResult()`: Consensus algorithm for resolver results (lines 169-200)

#### `src/types.ts`
- **Purpose**: TypeScript type definitions
- **Key Types**:
  - `DomainConfig`: Domain configuration (lines 1-4)
  - `DNSRecord`: Stored DNS record structure (lines 6-11)
  - `DNSCheckResult`: Check result with comparison data (lines 13-23)
  - `NotificationHandler`: Interface for notification systems (lines 25-28)

#### `src/config.ts`
- **Purpose**: Configuration management with TOML support
- **Key Components**:
  - `AppConfig` interface: App configuration structure (lines 4-10)
  - `TomlConfig` interface: TOML file structure (lines 12-24)
  - `fallbackConfig`: Minimal fallback configuration (lines 26-31)
  - `loadConfig()`: TOML parser with JSON fallback (lines 33-83)
- **Configuration Priority**:
  1. TOML file content (if provided)
  2. JSON from environment variable
  3. Fallback configuration

### Notification System

#### `src/notifications/base.ts`
- **Purpose**: Abstract base class for notification handlers
- **Key Methods**:
  - `filterChangedResults()`: Filters for changed/discrepancy results (lines 8-12)
  - `formatMessage()`: Formats alert messages with HTML (lines 14-54)

#### `src/notifications/telegram.ts`
- **Purpose**: Telegram notification implementation
- **Key Components**:
  - `TelegramNotificationHandler`: Telegram-specific handler (lines 9-50)
  - `sendTelegramMessage()`: Telegram Bot API integration (lines 30-49)

## Data Flow

1. **Trigger**: Cron (every minute) or manual HTTP request
2. **Configuration Loading**: `loadConfig()` reads from TOML file or environment
3. **DNS Resolution**:
   - Queries multiple DoH providers in parallel
   - Adds cache-busting parameters
   - Collects results from all resolvers
4. **Comparison**:
   - Retrieves previous state from KV store
   - Compares current vs previous IPs
   - Detects resolver discrepancies
5. **Storage**: Updates KV store with new state
6. **Notification**: Sends alerts only on changes/discrepancies

## Key Features

### Multi-Resolver Verification
- Queries 3 DNS providers simultaneously
- Detects DNS hijacking via resolver discrepancy
- Uses consensus algorithm for final result

### Change Detection
- Stores DNS history in Cloudflare KV
- Compares sorted IP arrays for changes
- Skips alerts on first check (baseline establishment)

### Cache Bypassing
- Adds timestamp-based cache buster to queries
- Sets no-cache headers
- Ensures fresh DNS results

### Record Type Support
- A records (IPv4)
- AAAA records (IPv6)
- CNAME records
- NS records (nameservers)

## Storage Schema

### KV Store Keys
Format: `dns:{domain}:{recordType}`
Example: `dns:example.com:A`

### KV Store Values
```json
{
  "domain": "example.com",
  "ips": ["93.184.216.34"],
  "timestamp": 1704110400000,
  "recordType": "A"
}
```

## Configuration

### TOML Configuration File (`dns-monitor.toml`)
The primary configuration method using TOML format:
```toml
[[domains]]
name = "Service Name"
domain = "example.com"
record_type = "A"  # A, AAAA, CNAME, NS
category = "category"
```

### Environment Variables
- `TELEGRAM_BOT_TOKEN`: Telegram bot token (secret)
- `TELEGRAM_CHAT_ID`: Telegram chat ID (secret)
- `DNS_MONITOR_CONFIG`: Legacy JSON config (fallback if TOML not available)

### wrangler.jsonc
- KV namespace binding: `DNS_HISTORY`
- Cron schedule: `* * * * *` (every minute)
- Compatibility date: `2025-08-29`
- Text file rules: Configured to import `*.toml` files

## Alert Types

### DNS Change Alert
Triggered when IPs change from previous check:
- Shows previous and current IPs
- Includes timestamp
- Only after baseline established

### DNS Hijacking Alert
Triggered when resolvers return different results:
- Shows each resolver's results
- Highlights discrepancy
- Critical security warning

## Extension Points

### Adding New Notification Handlers
1. Create new file in `src/notifications/`
2. Extend `BaseNotificationHandler`
3. Implement `notify()` method
4. Register in `performDNSCheck()` function

### Adding New DNS Providers
1. Add to `dohProviders` array in `DNSChecker`
2. Ensure provider supports DNS-over-HTTPS
3. Test response format compatibility

## Testing Considerations
- Tests run with `npm test` (Vitest + Cloudflare runtime)
- Single run mode configured
- Environment setup in `test/env.d.ts`

## Security Features
- No hardcoded expected IPs (dynamic detection)
- Multi-resolver consensus
- DNS cache bypassing
- Secure secret storage for credentials
- Public fetch restrictions (`global_fetch_strictly_public`)