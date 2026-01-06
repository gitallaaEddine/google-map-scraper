const fs = require("fs");
const BusinessScraper = require("./scraper");
const FileUtils = require("./fileUtils");

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    query: "restaurant new york",
    maxResults: 20,
    campaignName: null,
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
      case "-h":
      case "--help":
        console.log(`
Business Leads Scraper - Google Maps Lead Generation Tool

Usage: node index.js [options]

Options:
  -q, --query <string>     Search query (default: "restaurant new york")
  -l, --length <number>    Number of results to scrape (default: 20, max: 100)
  -n, --name <string>      Campaign name (optional, auto-generated if not provided)
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

Output:
  Results are saved in organized campaign folders:
  output/campaign_<name>_<timestamp>/
    ├── leads.json        (structured lead data)
    ├── leads.csv         (spreadsheet format)
    └── campaign_info.json (campaign metadata)
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Main CLI function
async function main() {
  const options = parseArguments();
  const scraper = new BusinessScraper();

  console.log("\n🔍 Business Leads Scraper");
  console.log("═".repeat(50));
  console.log(`Query: "${options.query}"`);
  console.log(`Max Results: ${options.maxResults}`);

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

    // Create campaign folder
    const timestamp = Date.now();
    const campaignName =
      options.campaignName ||
      options.query.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const outputDir = `output/campaign_${campaignName}_${timestamp}`;

    if (!fs.existsSync("output")) {
      fs.mkdirSync("output");
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // Save results
    const savedFiles = await FileUtils.saveToCampaign(processedData, outputDir);

    // Save campaign info
    const campaignInfo = {
      name: campaignName,
      query: options.query,
      maxResults: options.maxResults,
      actualResults: processedData.length,
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
    console.log(`📊 Leads Found: ${processedData.length}`);
    console.log(`📁 Output Folder: ${outputDir}`);
    console.log(`📄 Files Created:`);
    console.log(`   • ${savedFiles.jsonFile}`);
    console.log(`   • ${savedFiles.csvFile}`);
    console.log(`   • ${outputDir}/campaign_info.json`);

    // Quick stats
    const withPhone = processedData.filter((l) => l.phone).length;
    const withWebsite = processedData.filter((l) => l.website).length;
    const withEmail = processedData.filter(
      (l) => l.possibleEmails && l.possibleEmails.length > 0
    ).length;

    console.log("\n📈 Quick Stats:");
    console.log(`   • With Phone: ${withPhone}/${processedData.length}`);
    console.log(`   • With Website: ${withWebsite}/${processedData.length}`);
    console.log(
      `   • With Possible Emails: ${withEmail}/${processedData.length}`
    );
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
