# HubSpot → Klaviyo Contact Sync (Form-Based)

This repository contains a production-ready Node.js script that synchronizes HubSpot contacts into Klaviyo lists based on **HubSpot form submissions**.

The system supports:
- One-time **full sync**
- Ongoing **weekly incremental sync**
- Automatic rate-limit handling
- Profile deduplication
- Batch list updates
- GitHub Actions scheduling (no servers required)

---

## 🧠 How It Works

1. Fetch contacts from HubSpot (paginated)
2. Retrieve each contact’s form submissions
3. Match form titles to Klaviyo lists
4. Upsert Klaviyo profiles (create or reuse)
5. Batch add profiles to Klaviyo lists (1000 max per batch)
6. Log progress and retry on rate limits

---

## 🗂 Form → Klaviyo List Mapping

```js
const FORM_TO_LIST_MAP = {
  'Unific Customer Tracking Form': 'UWRCeP',
  'Primary Quote Request Form': 'VmLDWk',
  'Weld Testing Services Request Form': 'SFBsHf',
  'Email Newsletter Subscription via Website - Footer Embed': 'WW6wxH',
  'Contact': 'Y5umh4',
  'Education Discount Verification': 'TQM3zE',
  'Credit Application Form': 'Ws5JrU',
};


🔁 Sync Modes
Initial Full Sync

Syncs all HubSpot contacts

Run manually once

Recommended before automation

Weekly Incremental Sync

Syncs only contacts updated since last sync

Controlled by LAST_SYNC_AT

Runs automatically via GitHub Actions

🚀 Local Setup
1. Install Dependencies
npm install

2. Create .env (DO NOT COMMIT)
HUBSPOT_TOKEN=your_hubspot_private_app_token
KLAVIYO_API_KEY=your_klaviyo_private_api_key
LAST_SYNC_AT=2026-02-02T00:00:00.000Z

3. Run Sync
node hubspot-to-klaviyo-full-sync.js

🔐 Required Environment Variables
Variable	Description
HUBSPOT_TOKEN	HubSpot Private App token
KLAVIYO_API_KEY	Klaviyo Private API key
LAST_SYNC_AT	ISO timestamp of last successful sync
🤖 GitHub Actions Automation
Workflow Location
.github/workflows/sync.yml

Weekly Schedule (Every Friday)
schedule:
  - cron: '0 9 * * 5'


Runs automatically every Friday at 09:00 UTC.

Manual Run
workflow_dispatch:

📈 Logging & Progress Output

Example console output:

📊 Total contacts: 7303
📈 500/7303 (6%) — ETA ~12 min
🚀 Syncing 1272 profiles to Unific Customer Tracking Form
➕ Added 1000 profiles
➕ Added 272 profiles
✅ Full sync completed successfully

🚦 Error Handling

Rate limits (429) → automatic retry with backoff

Server errors (5xx) → retry

Existing profiles → lookup and reuse

Missing emails → skipped safely

List size >1000 → auto chunking

⚠ API Constraints
HubSpot

Pagination required (100 per page)

Rate limited

Klaviyo

Max 1000 profiles per list request

Profile creation is idempotent

🔐 Security Notes

.env is ignored via .gitignore

Secrets are stored in GitHub Actions → Secrets

No credentials committed to the repository

🛑 Non-Goals

This app does not:

Remove profiles from Klaviyo lists

Delete Klaviyo profiles

Sync custom properties (easy to extend)