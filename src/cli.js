const fs = require("fs");
const path = require("path");
const BusinessScraper = require("./scraper");
const FileUtils = require("./fileUtils");

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    query: "restaurant new york",
    maxResults: 20,
    campaignName: null,
    allowDuplicates: false,
    scanDuplicates: false, // New option
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-q":
      case "--query":
        options.query = args[i + 1];
        i++;
        break;
      case "-l":
      case "--length":
        const length = parseInt(args[i + 1]) || 20;
        options.maxResults = Math.min(length, 100); // Max 100 results
        i++;
        break;
      case "-n":
      case "--name":
        options.campaignName = args[i + 1];
        i++;
        break;
      case "-d":
      case "--allow-duplicates":
        options.allowDuplicates = true;
        break;
      case "-s":
      case "--scan-duplicates":
        options.scanDuplicates = true;
        break;
      case "-h":
      case "--help":
        console.log(`
Business Leads Scraper - Google Maps Lead Generation Tool

Usage: node index.js [options]

Options:
  -q, --query <string>     Search query (default: "restaurant new york")
  -l, --length <number>    Number of results to scrape (default: 20, max: 100)
  -n, --name <string>      Campaign name (optional, auto-generated if not provided)
  -d, --allow-duplicates   Include leads already scraped before (default: skip duplicates)
  -s, --scan-duplicates    Scan all campaigns for duplicate leads (no scraping)
  -h, --help               Show this help message

Examples:
  # USA searches
  node index.js -q "Restaurant New York" -l 50
  node index.js -q "Dental Clinic Los Angeles" -l 30
  node index.js -q "Auto Repair Chicago" -l 20 -n "Chicago_Auto_Q1"
  
  # Europe searches  
  node index.js -q "Restaurant Paris" -l 50
  node index.js -q "Auto Repair London" -l 30
  node index.js -q "Dental Clinic Berlin" -l 25
  
  # Middle East searches
  node index.js -q "Restaurant Dubai" -l 50
  node index.js -q "Real Estate Agency Abu Dhabi" -l 30
  node index.js -q "Auto Repair Riyadh" -l 20
  
  # Re-scrape including duplicates
  node index.js -q "Restaurant New York" -l 50 -d
  
  # Scan for duplicates across all campaigns
  node index.js -s

Output:
  Results are saved in organized campaign folders:
  output/campaign_<name>_<timestamp>/
    ├── leads.json        (structured lead data)
    ├── leads.csv         (spreadsheet format)
    └── campaign_info.json (campaign metadata)

Note:
  - Leads already in your history are automatically skipped (use -d to include them)
  - Deleted/blacklisted leads are never scraped again
  - Use -s to find and review duplicates across all campaigns
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Scan for duplicates across all campaigns
async function scanDuplicates() {
  console.log("\n🔍 Scanning all campaigns for duplicates...");
  console.log("═".repeat(60));

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    console.log("\n⚠️  No campaigns found. Run a scrape first.");
    return;
  }

  const campaigns = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith("campaign_"));

  if (campaigns.length === 0) {
    console.log("\n⚠️  No campaigns found. Run a scrape first.");
    return;
  }

  // Collect all leads with their source
  const allLeads = [];
  for (const campaign of campaigns) {
    const jsonPath = path.join(outputDir, campaign, "leads.json");
    if (fs.existsSync(jsonPath)) {
      try {
        const leads = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        leads.forEach((lead) => {
          allLeads.push({
            ...lead,
            _campaign: campaign,
          });
        });
      } catch (e) {
        // Skip invalid files
      }
    }
  }

  console.log(
    `\n📊 Scanned ${campaigns.length} campaigns, ${allLeads.length} total leads\n`
  );

  // Find duplicates by phone or name+address
  const seen = new Map();
  const duplicates = [];

  for (const lead of allLeads) {
    const phoneKey = lead.phone
      ? `phone:${lead.phone.replace(/\D/g, "")}`
      : null;
    const nameKey = `name:${(lead.name || "").toLowerCase()}_${(
      lead.address || ""
    ).toLowerCase()}`;
    const key = phoneKey || nameKey;

    if (seen.has(key)) {
      const original = seen.get(key);
      duplicates.push({
        original,
        duplicate: lead,
        matchedBy: phoneKey ? "phone" : "name+address",
      });
    } else {
      seen.set(key, lead);
    }
  }

  if (duplicates.length === 0) {
    console.log("✅ No duplicates found! Your data is clean.\n");
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate(s):\n`);
  console.log("─".repeat(60));

  duplicates.forEach((dup, i) => {
    console.log(`\n${i + 1}. ${dup.duplicate.name}`);
    console.log(`   Matched by: ${dup.matchedBy}`);
    console.log(
      `   📁 Original:  ${dup.original._campaign} (ID: ${dup.original.id})`
    );
    console.log(
      `   📁 Duplicate: ${dup.duplicate._campaign} (ID: ${dup.duplicate.id})`
    );
    if (dup.duplicate.phone) {
      console.log(`   📞 Phone: ${dup.duplicate.phone}`);
    }
    if (dup.duplicate.address) {
      console.log(`   📍 Address: ${dup.duplicate.address}`);
    }
  });

  console.log("\n" + "─".repeat(60));
  console.log("\n💡 To manage duplicates:");
  console.log("   1. Run: npm run web");
  console.log("   2. Click 'Scan Duplicates' button in the dashboard");
  console.log("   3. Review and delete duplicates as needed\n");
}

// Main CLI function
async function main() {
  const options = parseArguments();

  // Handle scan duplicates command
  if (options.scanDuplicates) {
    await scanDuplicates();
    return;
  }

  const scraper = new BusinessScraper();

  console.log("\n🔍 Business Leads Scraper");
  console.log("═".repeat(50));
  console.log(`Query: "${options.query}"`);
  console.log(`Max Results: ${options.maxResults}`);
  console.log(`Skip Duplicates: ${!options.allowDuplicates}`);

  try {
    // Scrape Google Maps
    console.log("\n📊 Scraping Google Maps...");
    await scraper.scrapeGoogleMaps(options.query, options.maxResults);

    // Process and clean data
    const processedData = await scraper.processResults();

    if (processedData.length === 0) {
      console.log("\n❌ No leads found. Try adjusting your search query.");
      return;
    }

    // Filter duplicates and blacklisted leads
    const filterResult = FileUtils.filterNewLeads(
      processedData,
      !options.allowDuplicates, // skipDuplicates
      true // always skip blacklisted
    );

    console.log("\n📋 Deduplication Results:");
    console.log(`   • Total scraped: ${filterResult.stats.total}`);
    console.log(`   • New leads: ${filterResult.stats.new}`);
    if (filterResult.stats.duplicates > 0) {
      console.log(
        `   • Skipped (already scraped): ${filterResult.stats.duplicates}`
      );
    }
    if (filterResult.stats.blacklisted > 0) {
      console.log(
        `   • Skipped (blacklisted/deleted): ${filterResult.stats.blacklisted}`
      );
    }

    const finalData = filterResult.newLeads;

    if (finalData.length === 0) {
      console.log(
        "\n⚠️  All leads were duplicates or blacklisted. No new leads to save."
      );
      console.log(
        '   Use -d flag to include duplicates: node index.js -q "..." -d'
      );
      return;
    }

    // Create campaign folder
    const timestamp = Date.now();
    const campaignName =
      options.campaignName ||
      options.query.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const campaignId = `campaign_${campaignName}_${timestamp}`;
    const outputDir = `output/${campaignId}`;

    if (!fs.existsSync("output")) {
      fs.mkdirSync("output");
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // Save results
    const savedFiles = await FileUtils.saveToCampaign(finalData, outputDir);

    // Add new leads to history
    FileUtils.addManyToHistory(finalData, campaignId);

    // Save campaign info
    const campaignInfo = {
      name: campaignName,
      query: options.query,
      maxResults: options.maxResults,
      actualResults: finalData.length,
      skippedDuplicates: filterResult.stats.duplicates,
      skippedBlacklisted: filterResult.stats.blacklisted,
      createdAt: new Date().toISOString(),
      outputPath: outputDir,
    };
    fs.writeFileSync(
      `${outputDir}/campaign_info.json`,
      JSON.stringify(campaignInfo, null, 2)
    );

    // Success summary
    console.log("\n✅ Scraping Complete!");
    console.log("─".repeat(50));
    console.log(`📊 New Leads Saved: ${finalData.length}`);
    console.log(`📁 Output Folder: ${outputDir}`);
    console.log(`📄 Files Created:`);
    console.log(`   • ${savedFiles.jsonFile}`);
    console.log(`   • ${savedFiles.csvFile}`);
    console.log(`   • ${outputDir}/campaign_info.json`);

    // Quick stats
    const withPhone = finalData.filter((l) => l.phone).length;
    const withWebsite = finalData.filter((l) => l.website).length;
    const withEmail = finalData.filter(
      (l) => l.possibleEmails && l.possibleEmails.length > 0
    ).length;

    console.log("\n📈 Quick Stats:");
    console.log(`   • With Phone: ${withPhone}/${finalData.length}`);
    console.log(`   • With Website: ${withWebsite}/${finalData.length}`);
    console.log(`   • With Possible Emails: ${withEmail}/${finalData.length}`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    await scraper.close();
  }
}

// Export for testing
module.exports = { main, parseArguments };

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
