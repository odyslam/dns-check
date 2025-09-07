# DNS Monitor - Architecture Documentation

## Overview
A Cloudflare Worker service that monitors DNS records for changes and potential hijacking attempts. It tracks DNS changes over time rather than maintaining expected IP lists, sending alerts only when changes are detected.

## Architecture Components

### Core Files

#### `src/ip-analyzer.ts`
- **Purpose**: IP intelligence and risk assessment
- **Key Components**:
  - `IPAnalyzer` class: Main analysis orchestrator
  - `analyzeIP()`: Collects geolocation, ASN, reputation data
  - `getGeolocation()`: Uses ip-api.com and ipapi.co APIs
  - `getReputation()`: Checks against threat databases
  - `getReverseDns()`: PTR record lookup via DoH
  - `assessRisk()`: Calculates threat level and recommendations
- **Risk Factors**:
  - Malicious IP detection
  - Geographic location changes
  - High-risk country movements
  - ASN/hosting provider changes
  - Missing reverse DNS

#### `src/index.ts`
- **Purpose**: Main entry point and request handler
- **Key Components**:
  - TOML config import: Imports `dns-monitor.toml` directly (line 5)
  - `Env` interface: Defines environment variables (lines 7-12)
  - `performDNSCheck()`: Orchestrates the DNS checking workflow (lines 14-44)
  - HTTP endpoints:
    - `/check`: Manual DNS check trigger (lines 51-56)
    - `/status`: Service health check (lines 58-64)
    - `/`: Default info endpoint (lines 66-69)
  - `scheduled()`: Cron trigger handler (lines 73-75)

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
  - `DomainConfig`: Domain configuration with name and category support (lines 1-6)
  - `DNSRecord`: Stored DNS record structure (lines 8-13)
  - `DNSCheckResult`: Check result with comparison data (lines 15-25)
  - `NotificationHandler`: Interface for notification systems (lines 27-30)

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

1. **Trigger**: Cron (every minute) or manual HTTP request (`/check`)
2. **Configuration Loading**: 
   - Primary: Imports and parses `dns-monitor.toml` file
   - Fallback: JSON from `DNS_MONITOR_CONFIG` env variable
   - Default: Minimal hardcoded configuration
3. **DNS Resolution**:
   - Queries 3 DoH providers in parallel (Cloudflare, Google, Quad9)
   - Adds timestamp-based cache-busting parameters
   - Collects and compares results from all resolvers
4. **Comparison**:
   - Retrieves previous state from KV store (key: `dns:{domain}:{recordType}`)
   - Compares sorted IP arrays for changes
   - Detects resolver discrepancies for hijacking detection
   - Skips alert on first check (baseline establishment)
5. **Storage**: Updates KV store with new state and timestamp
6. **Notification**: Sends alerts only on changes/discrepancies (not on first check)

## Key Features

### Multi-Resolver Verification
- Queries 3 DNS providers simultaneously
- Detects DNS hijacking via resolver discrepancy
- Uses consensus algorithm for final result

### Change Detection
- Stores DNS history in Cloudflare KV
- Compares sorted IP arrays for changes
- Skips alerts on first check (baseline establishment)

### Risk Assessment & IP Intelligence
- **Geolocation Analysis**: Tracks IP geographic locations
- **ASN Monitoring**: Identifies hosting providers and organizations
- **Reputation Checking**: Detects malicious IPs and threat categories
- **Reverse DNS Lookup**: Validates PTR records
- **Risk Scoring**: Automated threat level assessment (Low/Medium/High/Critical)
- **Smart Recommendations**: Context-aware security guidance

### Cache Bypassing
- Adds timestamp-based cache buster parameter (`cb={timestamp}`)
- Sets `Cache-Control: no-cache, no-store` headers
- Ensures fresh DNS results from each query

### Record Type Support
- A records (IPv4) - with full IP analysis
- AAAA records (IPv6) - with full IP analysis
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
- Text file rules: Configured to import `*.toml` files as text
- Compatibility flags: `global_fetch_strictly_public` for security

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
2. Extend `BaseNotificationHandler` class
3. Implement `notify()` method
4. Register in `performDNSCheck()` function in `src/index.ts`

### Adding New DNS Providers
1. Add to `dohProviders` array in `DNSChecker` class (`src/dns-checker.ts`)
2. Ensure provider supports DNS-over-HTTPS with JSON response
3. Test response format compatibility (should match DoH JSON spec)

### Adding New Record Types
1. Update `DomainConfig` type in `src/types.ts`
2. Modify `resolveDomain()` in `src/dns-checker.ts` to handle new type
3. Update TOML configuration documentation

## Testing
- **Test Runner**: Vitest with Cloudflare Workers runtime
- **Command**: `npm test` (single run mode)
- **Test Files**:
  - `test/index.spec.ts`: Main worker endpoints
  - `test/dns-checker.spec.ts`: DNS checking logic
  - `test/notifications.spec.ts`: Notification handlers
- **Environment**: Configured in `test/env.d.ts`

## Security Features

1. **Dynamic Detection**: No hardcoded expected IPs - adapts to legitimate changes
2. **Multi-Resolver Consensus**: Cross-validates results from 3 independent DNS providers
3. **Hijacking Detection**: Alerts on resolver discrepancies
4. **Cache Bypassing**: Prevents stale DNS results
5. **Secure Secrets**: Telegram credentials stored as Cloudflare secrets
6. **Fetch Restrictions**: `global_fetch_strictly_public` flag prevents internal network access
7. **DNS-over-HTTPS**: Encrypted DNS queries prevent MITM attacks