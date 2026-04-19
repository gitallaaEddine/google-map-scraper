# Business Leads Scraper

**🚀 Simple & powerful CLI tool for Google Maps lead generation with smart deduplication.**

Scrape business leads (name, address, phone, website, rating, etc.) from Google Maps in seconds. Perfect for sales teams, marketers, and agencies targeting USA, Europe, and the Middle East.

--- 

## ✨ Features

- **Lightning-fast scraping** from Google Maps
- **Smart deduplication** – automatically skips previously scraped leads (based on phone & name+address)
- **Blacklist system** – deleted leads are never scraped again
- **Web dashboard** for managing, editing, and restoring leads
- **Multiple output formats** – JSON + CSV
- **Campaign-based organization** with custom names
- **No duplicates** by default (optional with `-d` flag)
- Supports **USA, Europe, and Middle East** markets

---

## 📥 Installation

```bash
# Clone the repository
git clone 
cd business-leads-scraper

# Install dependencies
npm install

🚀 Quick Start
Run your first scrape:
node index.js -q "Restaurant New York" -l 20
This will scrape 20 restaurants in New York and save them in the output/ folder.

📱 CLI Commands
Basic Usage
node index.js [options]
Available Options
Option
Short
Description
Default
--query
-q
Search query (business type + location)
“restaurant new york”
--length
-l
Number of results to scrape (max 100)
20
--name
-n
Custom campaign name for output folder
auto-generated
--allow-duplicates
-d
Include leads already scraped (default: skip)
false
--help
-h
Show help message
-
Examples
# USA
node index.js -q "Dental Clinic Los Angeles" -l 30
node index.js -q "Auto Repair Chicago" -l 50 -n "Chicago_Auto_Q1"

# Europe
node index.js -q "Restaurant Paris" -l 50
node index.js -q "Auto Repair London" -l 30

# Middle East
node index.js -q "Real Estate Agency Dubai" -l 50
node index.js -q "Restaurant Riyadh" -l 40

# Re-scrape (only new leads)
node index.js -q "Plumber Miami" -l 50

# Re-scrape with duplicates allowed
node index.js -q "Plumber Miami" -l 50 -d

🔄 Smart Deduplication
When you run the same query again, the tool automatically skips duplicates:
	•	Primary check: Phone number
	•	Fallback check: Name + Address
	•	Blacklist: Deleted leads are permanently excluded
After every scrape you’ll see a summary:
📋 Deduplication Results:
   • Total scraped: 50
   • New leads: 23
   • Skipped (already scraped): 27
   • Skipped (blacklisted): 0
To reset duplicate tracking: delete data/history.json (blacklist stays intact).

🌐 Web Dashboard
Manage your leads visually:
npm run web
# Opens http://localhost:3000
Features:
	•	View campaigns
	•	Edit leads
	•	Delete → moves to Trash & blacklists
	•	Restore from Trash
	•	Permanent delete
	•	Empty Trash

📁 Output Structure
Leads are saved in organized campaign folders:
output/
└── campaign__/
    ├── leads.json
    ├── leads.csv
    └── campaign_info.json
JSON Format (example)
{
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
The CSV file is ready to open in Excel or Google Sheets.

🌍 Supported Markets
	•	USA: New York, Los Angeles, Chicago, Miami, Boston, Seattle, etc.
	•	Europe: London, Paris, Berlin, Madrid, Amsterdam, Milan, etc.
	•	Middle East: Dubai, Abu Dhabi, Riyadh, Doha, Kuwait City, etc.

💡 Tips for Best Results
	•	Be specific: "Dental Clinic Manhattan" works better than just "dentist"
	•	Always include city name
	•	Start small (-l 10) to test
	•	Use -n for organized campaign names
	•	Leads with phone numbers are highest value

❓ Troubleshooting
Issue
Solution
No results
Check internet / spelling / try different query
Browser errors
Run npm install puppeteer again
Slow scraping
Reduce -l or wait between large scrapes
Linux server issues
Install required Puppeteer dependencies

📂 Data Files
data/
├── history.json          # Duplicate tracking
├── blacklist.json        # Permanently excluded leads
├── trash/                # Soft-deleted leads
└── user_data.json        # Your notes

Made for lead generation pros who want clean, reusable, and organized business data.
Happy scraping! 🔥

Simple CLI tool for Google Maps lead generation with smart deduplication
**✅ Ready to copy-paste!**  
Just copy everything above and save it as `README.md` in your GitHub repository. It’s clean, professional, and user-friendly for anyone visiting your project. Let me know if you want to add screenshots, badges, or a license section!
