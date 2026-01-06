const fs = require("fs");

class FileUtils {
  static async saveToFile(data, filename = "business_leads") {
    const timestamp = new Date().toISOString().split("T")[0];
    const csvFilename = `output/${filename}_${timestamp}.csv`;
    const jsonFilename = `output/${filename}_${timestamp}.json`;

    // Create output directory if it doesn't exist
    if (!fs.existsSync("output")) {
      fs.mkdirSync("output");
    }

    // Save as CSV
    const csvHeader =
      "ID,Name,Address,Phone,Website,Reference Link,Possible Emails,Rating,Source,Scraped At\n";
    const csvRows = data
      .map(
        (business) =>
          `${business.id},"${business.name}","${business.address}","${
            business.phone
          }","${business.website}","${
            business.referenceLink
          }","${business.possibleEmails.join("; ")}","${business.rating}","${
            business.source
          }","${business.scrapedAt}"`
      )
      .join("\n");

    fs.writeFileSync(csvFilename, csvHeader + csvRows);

    // Save as JSON
    fs.writeFileSync(jsonFilename, JSON.stringify(data, null, 2));

    console.log(`Results saved to ${csvFilename} and ${jsonFilename}`);
    return { csvFile: csvFilename, jsonFile: jsonFilename };
  }

  static loadLeads(jsonFile) {
    try {
      const data = fs.readFileSync(jsonFile, "utf8");
      const leads = JSON.parse(data);
      console.log(`Loaded ${leads.length} leads from ${jsonFile}`);
      return leads;
    } catch (error) {
      console.error("Error loading leads:", error);
      return [];
    }
  }

  // Save leads to campaign folder (clean output format)
  static async saveToCampaign(data, outputDir) {
    const timestamp = new Date().toISOString();

    // Clean data format for output (no intelligence/scoring)
    const cleanData = data.map((business) => ({
      name: business.name || "",
      address: business.address || "",
      phone: business.phone || "",
      rating: business.rating || "",
      website: business.website || "",
      referenceLink: business.referenceLink || "",
      hasWebsite: !!business.website,
      possibleEmails: business.possibleEmails || [],
      source: "Google Maps",
      scrapedAt: timestamp,
    }));

    // Separate and sort: NO WEBSITE first (most valuable for outreach)
    const noWebsite = cleanData.filter((b) => !b.hasWebsite);
    const withWebsite = cleanData.filter((b) => b.hasWebsite);

    // All leads sorted: no website first, then with website
    const sortedData = [...noWebsite, ...withWebsite].map((b, index) => ({
      id: index + 1,
      ...b,
    }));

    // Add IDs to separated lists
    const noWebsiteWithId = noWebsite.map((b, index) => ({
      id: index + 1,
      ...b,
    }));
    const withWebsiteWithId = withWebsite.map((b, index) => ({
      id: index + 1,
      ...b,
    }));

    // CSV header
    const csvHeader =
      "ID,Name,Address,Phone,Rating,Website,Reference Link,Has Website,Possible Emails,Source,Scraped At\n";

    const toCsvRows = (items) =>
      items
        .map(
          (b) =>
            `${b.id},"${b.name}","${b.address}","${b.phone}","${b.rating}","${
              b.website
            }","${b.referenceLink}",${b.hasWebsite},"${b.possibleEmails.join(
              "; "
            )}","${b.source}","${b.scrapedAt}"`
        )
        .join("\n");

    // Save ALL leads (sorted: no website first)
    fs.writeFileSync(
      `${outputDir}/leads.json`,
      JSON.stringify(sortedData, null, 2)
    );
    fs.writeFileSync(
      `${outputDir}/leads.csv`,
      csvHeader + toCsvRows(sortedData)
    );

    // Save NO WEBSITE leads (your priority targets)
    if (noWebsiteWithId.length > 0) {
      fs.writeFileSync(
        `${outputDir}/leads_no_website.json`,
        JSON.stringify(noWebsiteWithId, null, 2)
      );
      fs.writeFileSync(
        `${outputDir}/leads_no_website.csv`,
        csvHeader + toCsvRows(noWebsiteWithId)
      );
    }

    // Save WITH WEBSITE leads
    if (withWebsiteWithId.length > 0) {
      fs.writeFileSync(
        `${outputDir}/leads_with_website.json`,
        JSON.stringify(withWebsiteWithId, null, 2)
      );
      fs.writeFileSync(
        `${outputDir}/leads_with_website.csv`,
        csvHeader + toCsvRows(withWebsiteWithId)
      );
    }

    // Log summary
    console.log(`\n📂 Files saved to ${outputDir}/`);
    console.log(
      `   📄 leads.json/csv - All ${sortedData.length} leads (no website first)`
    );
    if (noWebsiteWithId.length > 0) {
      console.log(
        `   🎯 leads_no_website.json/csv - ${noWebsiteWithId.length} leads (priority targets)`
      );
    }
    if (withWebsiteWithId.length > 0) {
      console.log(
        `   🌐 leads_with_website.json/csv - ${withWebsiteWithId.length} leads`
      );
    }

    return {
      csvFile: `${outputDir}/leads.csv`,
      jsonFile: `${outputDir}/leads.json`,
      noWebsiteCount: noWebsiteWithId.length,
      withWebsiteCount: withWebsiteWithId.length,
    };
  }

  // Country code mapping for international phone formatting
  static countryPhoneCodes = {
    // USA & Canada
    1: { name: "USA/Canada", format: "+1 (XXX) XXX-XXXX" },
    // Europe
    44: { name: "UK", format: "+44 XXXX XXXXXX" },
    33: { name: "France", format: "+33 X XX XX XX XX" },
    49: { name: "Germany", format: "+49 XXX XXXXXXX" },
    39: { name: "Italy", format: "+39 XXX XXX XXXX" },
    34: { name: "Spain", format: "+34 XXX XXX XXX" },
    31: { name: "Netherlands", format: "+31 XX XXX XXXX" },
    32: { name: "Belgium", format: "+32 XXX XX XX XX" },
    41: { name: "Switzerland", format: "+41 XX XXX XX XX" },
    43: { name: "Austria", format: "+43 X XXXXXXXX" },
    45: { name: "Denmark", format: "+45 XX XX XX XX" },
    46: { name: "Sweden", format: "+46 XX XXX XX XX" },
    47: { name: "Norway", format: "+47 XXX XX XXX" },
    48: { name: "Poland", format: "+48 XXX XXX XXX" },
    351: { name: "Portugal", format: "+351 XXX XXX XXX" },
    353: { name: "Ireland", format: "+353 XX XXX XXXX" },
    358: { name: "Finland", format: "+358 XX XXX XXXX" },
    // Middle East
    971: { name: "UAE", format: "+971 X XXX XXXX" },
    966: { name: "Saudi Arabia", format: "+966 X XXX XXXX" },
    974: { name: "Qatar", format: "+974 XXXX XXXX" },
    973: { name: "Bahrain", format: "+973 XXXX XXXX" },
    965: { name: "Kuwait", format: "+965 XXXX XXXX" },
    968: { name: "Oman", format: "+968 XXXX XXXX" },
    962: { name: "Jordan", format: "+962 X XXX XXXX" },
    961: { name: "Lebanon", format: "+961 X XXX XXX" },
    20: { name: "Egypt", format: "+20 XX XXXX XXXX" },
  };

  static formatPhoneNumber(phone) {
    if (!phone) return null;

    // Clean the phone number
    let cleaned = phone.replace(/[^\d+]/g, "");

    // If starts with +, remove it for processing
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }

    // Try to detect country code and format
    for (const [code, info] of Object.entries(this.countryPhoneCodes)) {
      if (cleaned.startsWith(code)) {
        return "+" + cleaned;
      }
    }

    // If no country code detected, return with + if long enough
    if (cleaned.length >= 10) {
      return "+" + cleaned;
    }

    return phone; // Return original if can't format
  }

  static detectCountry(phone) {
    if (!phone) return "Unknown";

    let cleaned = phone.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.substring(1);
    }

    // Check longest codes first (3 digits), then shorter
    const sortedCodes = Object.entries(this.countryPhoneCodes).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [code, info] of sortedCodes) {
      if (cleaned.startsWith(code)) {
        return info.name;
      }
    }

    return "Unknown";
  }
}

module.exports = FileUtils;
