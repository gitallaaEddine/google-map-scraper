const fs = require("fs");
const path = require("path");

// Paths for deduplication system
const DATA_DIR = path.join(__dirname, "../data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const BLACKLIST_FILE = path.join(DATA_DIR, "blacklist.json");
const TRASH_DIR = path.join(DATA_DIR, "trash");

class FileUtils {
  // ==================== DEDUPLICATION SYSTEM ====================

  // Ensure data directories exist
  static ensureDataDirs() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(TRASH_DIR)) {
      fs.mkdirSync(TRASH_DIR, { recursive: true });
    }
  }

  // Generate unique identifier for a lead (phone preferred, fallback to name+address hash)
  static generateLeadId(lead) {
    if (lead.phone && lead.phone.trim()) {
      // Clean phone: remove all non-digits
      return `phone:${lead.phone.replace(/\D/g, "")}`;
    }
    // Fallback: name + address normalized
    const nameNorm = (lead.name || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_");
    const addrNorm = (lead.address || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .substring(0, 50);
    return `name:${nameNorm}|addr:${addrNorm}`;
  }

  // Load history of all scraped leads
  static loadHistory() {
    this.ensureDataDirs();
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
      }
    } catch (error) {
      console.error("Error loading history:", error.message);
    }
    return { leads: {}, lastUpdated: null };
  }

  // Save lead to history
  static addToHistory(lead, campaignId) {
    const history = this.loadHistory();
    const leadId = this.generateLeadId(lead);

    history.leads[leadId] = {
      name: lead.name,
      phone: lead.phone,
      address: lead.address,
      campaignId: campaignId,
      addedAt: new Date().toISOString(),
    };
    history.lastUpdated = new Date().toISOString();

    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }

  // Add multiple leads to history
  static addManyToHistory(leads, campaignId) {
    const history = this.loadHistory();

    leads.forEach((lead) => {
      const leadId = this.generateLeadId(lead);
      history.leads[leadId] = {
        name: lead.name,
        phone: lead.phone,
        address: lead.address,
        campaignId: campaignId,
        addedAt: new Date().toISOString(),
      };
    });

    history.lastUpdated = new Date().toISOString();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }

  // Check if lead exists in history
  static isInHistory(lead) {
    const history = this.loadHistory();
    const leadId = this.generateLeadId(lead);
    return !!history.leads[leadId];
  }

  // Load blacklist (deleted leads that should never be scraped again)
  static loadBlacklist() {
    this.ensureDataDirs();
    try {
      if (fs.existsSync(BLACKLIST_FILE)) {
        return JSON.parse(fs.readFileSync(BLACKLIST_FILE, "utf8"));
      }
    } catch (error) {
      console.error("Error loading blacklist:", error.message);
    }
    return { leads: {}, lastUpdated: null };
  }

  // Add lead to blacklist
  static addToBlacklist(lead, reason = "deleted") {
    const blacklist = this.loadBlacklist();
    const leadId = this.generateLeadId(lead);

    blacklist.leads[leadId] = {
      name: lead.name,
      phone: lead.phone,
      address: lead.address,
      reason: reason,
      blacklistedAt: new Date().toISOString(),
    };
    blacklist.lastUpdated = new Date().toISOString();

    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
  }

  // Remove lead from blacklist (for restore from trash)
  static removeFromBlacklist(lead) {
    const blacklist = this.loadBlacklist();
    const leadId = this.generateLeadId(lead);

    if (blacklist.leads[leadId]) {
      delete blacklist.leads[leadId];
      blacklist.lastUpdated = new Date().toISOString();
      fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
      return true;
    }
    return false;
  }

  // Check if lead is blacklisted
  static isBlacklisted(lead) {
    const blacklist = this.loadBlacklist();
    const leadId = this.generateLeadId(lead);
    return !!blacklist.leads[leadId];
  }

  // Filter out duplicates and blacklisted leads from scraped results
  static filterNewLeads(leads, skipDuplicates = true, skipBlacklisted = true) {
    const history = skipDuplicates ? this.loadHistory() : { leads: {} };
    const blacklist = skipBlacklisted ? this.loadBlacklist() : { leads: {} };

    const newLeads = [];
    const skippedDuplicates = [];
    const skippedBlacklisted = [];

    leads.forEach((lead) => {
      const leadId = this.generateLeadId(lead);

      if (blacklist.leads[leadId]) {
        skippedBlacklisted.push(lead);
      } else if (history.leads[leadId]) {
        skippedDuplicates.push(lead);
      } else {
        newLeads.push(lead);
      }
    });

    return {
      newLeads,
      skippedDuplicates,
      skippedBlacklisted,
      stats: {
        total: leads.length,
        new: newLeads.length,
        duplicates: skippedDuplicates.length,
        blacklisted: skippedBlacklisted.length,
      },
    };
  }

  // ==================== TRASH SYSTEM ====================

  // Move lead to trash
  static moveToTrash(lead, campaignId) {
    this.ensureDataDirs();

    const trashEntry = {
      ...lead,
      campaignId: campaignId,
      deletedAt: new Date().toISOString(),
    };

    // Load or create trash file
    const trashFile = path.join(TRASH_DIR, "deleted_leads.json");
    let trash = { leads: [], lastUpdated: null };

    try {
      if (fs.existsSync(trashFile)) {
        trash = JSON.parse(fs.readFileSync(trashFile, "utf8"));
      }
    } catch (error) {
      console.error("Error loading trash:", error.message);
    }

    // Add to trash
    trash.leads.push(trashEntry);
    trash.lastUpdated = new Date().toISOString();

    fs.writeFileSync(trashFile, JSON.stringify(trash, null, 2));

    // Add to blacklist so it won't be scraped again
    this.addToBlacklist(lead, "deleted");

    return trashEntry;
  }

  // Get all trash items
  static getTrash() {
    this.ensureDataDirs();
    const trashFile = path.join(TRASH_DIR, "deleted_leads.json");

    try {
      if (fs.existsSync(trashFile)) {
        return JSON.parse(fs.readFileSync(trashFile, "utf8"));
      }
    } catch (error) {
      console.error("Error loading trash:", error.message);
    }

    return { leads: [], lastUpdated: null };
  }

  // Restore lead from trash
  static restoreFromTrash(trashIndex) {
    const trash = this.getTrash();

    if (trashIndex < 0 || trashIndex >= trash.leads.length) {
      return null;
    }

    const lead = trash.leads.splice(trashIndex, 1)[0];
    trash.lastUpdated = new Date().toISOString();

    const trashFile = path.join(TRASH_DIR, "deleted_leads.json");
    fs.writeFileSync(trashFile, JSON.stringify(trash, null, 2));

    // Remove from blacklist
    this.removeFromBlacklist(lead);

    return lead;
  }

  // Permanently delete from trash
  static permanentlyDelete(trashIndex) {
    const trash = this.getTrash();

    if (trashIndex < 0 || trashIndex >= trash.leads.length) {
      return null;
    }

    const lead = trash.leads.splice(trashIndex, 1)[0];
    trash.lastUpdated = new Date().toISOString();

    const trashFile = path.join(TRASH_DIR, "deleted_leads.json");
    fs.writeFileSync(trashFile, JSON.stringify(trash, null, 2));

    // Keep in blacklist (still won't be scraped again)
    return lead;
  }

  // Empty entire trash (permanently delete all)
  static emptyTrash() {
    const trashFile = path.join(TRASH_DIR, "deleted_leads.json");
    const trash = { leads: [], lastUpdated: new Date().toISOString() };
    fs.writeFileSync(trashFile, JSON.stringify(trash, null, 2));
    return true;
  }

  // ==================== ORIGINAL FILE OPERATIONS ====================

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
