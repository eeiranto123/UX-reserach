# Products

Each `.json` file here is a product that can be selected in the "Product" dropdown. Files starting with `_` are ignored.

| Field | Purpose |
|---|---|
| `id`, `name` | Identifier and display name (the name is used in the study title: `DATE PRODUCT synthetic testing`) |
| `environment` | `live` or `staging` - live products get extra safety instructions and a warning in the UI |
| `defaultUrl` | Pre-filled starting URL |
| `allowedHosts` | Hosts the agent may visit for this product (subdomains included) |
| `locale`, `timezone` | Browser language/timezone, so the site renders as for a local visitor |
| `blockedUrlPatterns` | Case-insensitive substrings; any navigation to a URL containing one is blocked (keep checkout/payment here for live sites) |

Check `blockedUrlPatterns` against the real site's checkout and payment URLs before running large studies.
