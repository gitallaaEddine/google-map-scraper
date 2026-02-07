   # Business Leads Scraper - User Guide

## 🚀 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Run Your First Scrape

```bash
node index.js -q "Restaurant New York" -l 20
```

## 📱 CLI Commands

### Basic Usage

```bash
node index.js [options]
```

### Options

| Option               | Short | Description                                   | Default               |
| -------------------- | ----- | --------------------------------------------- | --------------------- |
| `--query`            | `-q`  | Search query (business type + location)       | "restaurant new york" |
| `--length`           | `-l`  | Number of results to scrape (max 100)         | 20                    |
| `--name`             | `-n`  | Campaign name for output folder               | auto-generated        |
| `--allow-duplicates` | `-d`  | Include leads already scraped (default: skip) | false                 |
| `--help`             | `-h`  | Show help message                             | -                     |

### Examples

```bash
# USA searches
node index.js -q "Dental Clinic Los Angeles" -l 30
node index.js -q "Auto Repair Chicago" -l 50 -n "Chicago_Auto_Q1"
node index.js -q "Restaurant Manhattan" -l 25

# Europe searches
node index.js -q "Auto Repair London" -l 30
node index.js -q "Restaurant Paris" -l 50
node index.js -q "Dental Clinic Berlin" -l 25

# Middle East searches
node index.js -q "Restaurant Dubai" -l 50
node index.js -q "Real Estate Agency Abu Dhabi" -l 30
node index.js -q "Auto Repair Riyadh" -l 20

# Re-scrape same query (only new leads)
node index.js -q "Restaurant New York" -l 50

# Re-scrape including duplicates
node index.js -q "Restaurant New York" -l 50 -d
```

## 🔄 Scraping the Same Query Again

### Automatic Deduplication

When you scrape the same query again, **duplicates are automatically skipped**:

```bash
# First scrape
node index.js -q "Restaurant Manhattan" -l 50
# Result: 50 new leads saved

# Second scrape (same query)
node index.js -q "Restaurant Manhattan" -l 50
# Result: Only NEW leads are saved (duplicates skipped)
```

### How It Works

1. **Phone Number Matching** - Primary identifier (most reliable)
2. **Name + Address Matching** - Fallback when no phone available
3. **Blacklist Check** - Deleted leads are never scraped again

### Deduplication Stats

After each scrape, you'll see:

```
📋 Deduplication Results:
   • Total scraped: 50
   • New leads: 23
   • Skipped (already scraped): 27
   • Skipped (blacklisted/deleted): 0
```

### Including Duplicates

To scrape duplicates (not recommended):

```bash
node index.js -q "Restaurant Manhattan" -l 50 -d
```

**⚠️ Note:** Blacklisted (deleted) leads are NEVER scraped, even with `-d` flag.

### Workflow for Re-scraping

1. **Monthly Updates**

   ```bash
   # Scrape again after a month to find new businesses
   node index.js -q "Plumber Chicago" -l 100
   ```

2. **Expanding Territory**

   ```bash
   # Same business type, different location
   node index.js -q "Plumber Chicago Downtown" -l 50
   node index.js -q "Plumber Chicago Suburbs" -l 50
   ```

3. **Clean Slate** (if needed)
   - Delete `data/history.json` to reset duplicate tracking
   - Keep `data/blacklist.json` to maintain deleted leads list

## 🗑️ Managing Leads (Dashboard)

### Delete & Trash System

**Access the dashboard:**

```bash
npm run web
# Opens at http://localhost:3000
```

### Deleting Leads

1. Open a campaign
2. Click "Edit" on any lead
3. Click "🗑️ Delete" button
4. Lead moves to Trash and is **blacklisted from future scrapes**

### Trash Management

Click the **"🗑️ Trash"** stat card in the header to:

- **Restore** → Returns lead to original campaign (removes from blacklist)
- **Permanently Delete** → Removes from trash (stays blacklisted)
- **Empty Trash** → Clears all trash items

**Important:** Deleted leads won't appear in future scrapes, even if you re-scrape the same query.

## 📁 Output Structure

Results are saved in organized campaign folders:

```
output/
└── campaign_<name>_<timestamp>/
    ├── leads.json         # Structured lead data
    ├── leads.csv          # Spreadsheet format
    └── campaign_info.json # Campaign metadata
```

### JSON Output Format

```json
{
  "id": 1,
  "name": "Business Name",
  "address": "123 Main Street",
  "phone": "+1 555 123 4567",
  "rating": "4.7",
  "website": "https://example.com",
  "referenceLink": "https://google.com/maps/place/...",
  "hasWebsite": true,
  "possibleEmails": ["info@example.com"],
  "source": "Google Maps",
  "scrapedAt": "2025-12-26T10:30:00.000Z"
}
```

### CSV Output

The CSV file can be opened in Excel, Google Sheets, or any spreadsheet application with columns:

- ID, Name, Address, Phone, Rating, Website, Reference Link, Has Website, Possible Emails, Source, Scraped At

## 🌍 Supported Markets

### USA

- New York, Los Angeles, San Francisco, Chicago, Houston, Miami, Boston, Seattle, Dallas, Atlanta, Denver, Phoenix, Las Vegas, Washington DC

### Europe

- London, Paris, Berlin, Munich, Frankfurt, Amsterdam, Rotterdam, Milan, Rome, Madrid, Barcelona, Brussels, Vienna, Zurich, Geneva

### Middle East

- Dubai, Abu Dhabi, Doha, Riyadh, Jeddah, Kuwait City, Manama, Muscat

## 🔧 Tips for Best Results

### Effective Search Queries

- **Be specific**: Use "Restaurant Manhattan" instead of just "Restaurant"
- **Include location**: Always add city name for targeted results
- **Use business type**: "Dental Clinic", "Auto Repair", "Real Estate Agency"

### Recommended Workflow

1. Start with 10-20 leads for testing
2. Review the results in the JSON/CSV file
3. Scale up to 50-100 leads once satisfied
4. Use the `-n` flag to organize different campaigns

### Data Quality

- Leads with phone numbers are best for direct outreach
- Leads with websites can be researched further
- Use the `hasWebsite` field to filter leads
- Google Maps reference links are always included for verification

## ❓ Troubleshooting

### No Results Found

- Check your internet connection
- Try a different search query
- Make sure the location is spelled correctly

### Browser Errors

- Ensure Puppeteer is installed: `npm install puppeteer`
- On Linux servers, you may need additional dependencies

### Slow Scraping

- Reduce the number of results with `-l`
- Google Maps may rate-limit frequent requests
- Wait a few minutes between large scrapes

## 📝 Quick Reference

```bash
# Show help
node index.js -h

# Quick 10-lead test
node index.js -q "Coffee Shop Boston" -l 10

# Full campaign with custom name
node index.js -q "Plumber Miami" -l 50 -n "Miami_Plumbers_Dec2025"

# Re-scrape (only new leads saved)
node index.js -q "Plumber Miami" -l 50

# Web dashboard
npm run web
```

## 📂 Data Files

The tool creates organized data files:

```
data/
├── history.json          # All scraped leads (for duplicate detection)
├── blacklist.json        # Deleted leads (never scraped again)
├── trash/
│   └── deleted_leads.json # Soft-deleted leads (can restore)
└── user_data.json        # Your notes and priorities

output/
└── campaign_*/           # Campaign folders with leads
```

---

_Simple CLI tool for Google Maps lead generation with smart deduplication_
