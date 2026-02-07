const express = require("express");
const fs = require("fs");
const path = require("path");
const FileUtils = require("../fileUtils");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Data file for user notes and priorities
const USER_DATA_FILE = path.join(__dirname, "../../data/user_data.json");
const OUTPUT_DIR = path.join(__dirname, "../../output");

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(USER_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(USER_DATA_FILE)) {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify({ leads: {} }, null, 2));
  }
}

// Load user data (notes, priorities)
function loadUserData() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(USER_DATA_FILE, "utf8"));
  } catch (error) {
    return { leads: {} };
  }
}

// Save user data
function saveUserData(data) {
  ensureDataDir();
  fs.writeFileSync(USER_DATA_FILE, JSON.stringify(data, null, 2));
}

// GET /api/campaigns - List all campaigns
app.get("/api/campaigns", (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json([]);
    }

    const campaigns = fs
      .readdirSync(OUTPUT_DIR)
      .filter((dir) => dir.startsWith("campaign_"))
      .map((dir) => {
        const campaignPath = path.join(OUTPUT_DIR, dir);
        const infoFile = path.join(campaignPath, "campaign_info.json");
        const leadsFile = path.join(campaignPath, "leads.json");

        let info = { name: dir, query: "", createdAt: "" };
        let leadCount = 0;

        if (fs.existsSync(infoFile)) {
          info = JSON.parse(fs.readFileSync(infoFile, "utf8"));
        }

        if (fs.existsSync(leadsFile)) {
          const leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));
          leadCount = leads.length;
        }

        return {
          id: dir,
          name: info.name || dir,
          query: info.query || "",
          leadCount,
          createdAt: info.createdAt || "",
          path: campaignPath,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/campaigns/:id/leads - Get leads for a campaign
app.get("/api/campaigns/:id/leads", (req, res) => {
  try {
    const campaignId = req.params.id;
    const leadsFile = path.join(OUTPUT_DIR, campaignId, "leads.json");

    if (!fs.existsSync(leadsFile)) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));
    const userData = loadUserData();
    const campaignUserData = userData.leads[campaignId] || {};

    // Merge leads with user data (notes, priorities)
    const mergedLeads = leads.map((lead) => {
      const userLead = campaignUserData[lead.id] || {};
      return {
        ...lead,
        note: userLead.note || "",
        priority: userLead.priority || "none",
      };
    });

    res.json(mergedLeads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/campaigns/:campaignId/leads/:leadId - Update lead note/priority
app.put("/api/campaigns/:campaignId/leads/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;
    const { note, priority } = req.body;

    const userData = loadUserData();

    if (!userData.leads[campaignId]) {
      userData.leads[campaignId] = {};
    }

    userData.leads[campaignId][leadId] = {
      note:
        note !== undefined
          ? note
          : userData.leads[campaignId][leadId]?.note || "",
      priority:
        priority !== undefined
          ? priority
          : userData.leads[campaignId][leadId]?.priority || "none",
      updatedAt: new Date().toISOString(),
    };

    saveUserData(userData);

    res.json({ success: true, data: userData.leads[campaignId][leadId] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stats - Get overall stats
app.get("/api/stats", (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({
        campaigns: 0,
        totalLeads: 0,
        withNotes: 0,
        inTrash: 0,
      });
    }

    const campaigns = fs
      .readdirSync(OUTPUT_DIR)
      .filter((dir) => dir.startsWith("campaign_"));
    let totalLeads = 0;
    let noWebsite = 0;

    campaigns.forEach((dir) => {
      const leadsFile = path.join(OUTPUT_DIR, dir, "leads.json");
      if (fs.existsSync(leadsFile)) {
        const leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));
        totalLeads += leads.length;
        noWebsite += leads.filter((l) => !l.hasWebsite).length;
      }
    });

    const userData = loadUserData();
    let withNotes = 0;
    Object.values(userData.leads).forEach((campaign) => {
      Object.values(campaign).forEach((lead) => {
        if (lead.note && lead.note.trim()) withNotes++;
      });
    });

    // Get trash count
    const trash = FileUtils.getTrash();
    const inTrash = trash.leads ? trash.leads.length : 0;

    res.json({
      campaigns: campaigns.length,
      totalLeads,
      noWebsite,
      withNotes,
      inTrash,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TRASH API ====================

// DELETE /api/campaigns/:campaignId/leads/:leadId - Move lead to trash
app.delete("/api/campaigns/:campaignId/leads/:leadId", (req, res) => {
  try {
    const { campaignId, leadId } = req.params;
    const leadsFile = path.join(OUTPUT_DIR, campaignId, "leads.json");

    if (!fs.existsSync(leadsFile)) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Load leads
    let leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));
    const leadIndex = leads.findIndex((l) => l.id === parseInt(leadId));

    if (leadIndex === -1) {
      return res.status(404).json({ error: "Lead not found" });
    }

    // Get the lead to delete
    const leadToDelete = leads[leadIndex];

    // Move to trash and blacklist
    FileUtils.moveToTrash(leadToDelete, campaignId);

    // Remove from leads file
    leads.splice(leadIndex, 1);

    // Re-index remaining leads
    leads = leads.map((lead, index) => ({ ...lead, id: index + 1 }));

    // Save updated leads
    fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));

    // Also update the CSV file
    updateCsvFile(path.join(OUTPUT_DIR, campaignId, "leads.csv"), leads);

    // Remove from user data
    const userData = loadUserData();
    if (userData.leads[campaignId] && userData.leads[campaignId][leadId]) {
      delete userData.leads[campaignId][leadId];
      saveUserData(userData);
    }

    res.json({
      success: true,
      message: "Lead moved to trash",
      remainingLeads: leads.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/trash - Get all trash items
app.get("/api/trash", (req, res) => {
  try {
    const trash = FileUtils.getTrash();
    const trashWithIndex = trash.leads.map((lead, index) => ({
      ...lead,
      trashIndex: index,
    }));
    res.json({
      leads: trashWithIndex,
      count: trash.leads.length,
      lastUpdated: trash.lastUpdated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/trash/:index/restore - Restore lead from trash
app.post("/api/trash/:index/restore", (req, res) => {
  try {
    const trashIndex = parseInt(req.params.index);
    const restoredLead = FileUtils.restoreFromTrash(trashIndex);

    if (!restoredLead) {
      return res.status(404).json({ error: "Trash item not found" });
    }

    // Optionally restore to original campaign
    const campaignId = restoredLead.campaignId;
    if (campaignId) {
      const leadsFile = path.join(OUTPUT_DIR, campaignId, "leads.json");
      if (fs.existsSync(leadsFile)) {
        const leads = JSON.parse(fs.readFileSync(leadsFile, "utf8"));

        // Remove campaign-specific fields before restoring
        const {
          campaignId: _,
          deletedAt: __,
          trashIndex: ___,
          ...cleanLead
        } = restoredLead;
        cleanLead.id = leads.length + 1;
        cleanLead.restoredAt = new Date().toISOString();

        leads.push(cleanLead);
        fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
        updateCsvFile(path.join(OUTPUT_DIR, campaignId, "leads.csv"), leads);
      }
    }

    res.json({
      success: true,
      message: "Lead restored from trash",
      lead: restoredLead,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/trash/:index - Permanently delete from trash
app.delete("/api/trash/:index", (req, res) => {
  try {
    const trashIndex = parseInt(req.params.index);
    const deletedLead = FileUtils.permanentlyDelete(trashIndex);

    if (!deletedLead) {
      return res.status(404).json({ error: "Trash item not found" });
    }

    res.json({
      success: true,
      message: "Lead permanently deleted",
      lead: deletedLead,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/trash - Empty entire trash
app.delete("/api/trash", (req, res) => {
  try {
    FileUtils.emptyTrash();
    res.json({ success: true, message: "Trash emptied" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DUPLICATES API ====================

// GET /api/duplicates - Scan all campaigns for duplicate leads
app.get("/api/duplicates", (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ duplicates: [], stats: { total: 0, duplicates: 0 } });
    }

    const campaigns = fs
      .readdirSync(OUTPUT_DIR)
      .filter((dir) => dir.startsWith("campaign_"));

    // Collect all leads with their source
    const allLeads = [];
    for (const campaign of campaigns) {
      const jsonPath = path.join(OUTPUT_DIR, campaign, "leads.json");
      if (fs.existsSync(jsonPath)) {
        try {
          const leads = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
          leads.forEach((lead) => {
            allLeads.push({
              ...lead,
              campaignId: campaign,
            });
          });
        } catch (e) {
          // Skip invalid files
        }
      }
    }

    // Find duplicates by phone or name+address
    const seen = new Map();
    const duplicates = [];

    for (const lead of allLeads) {
      const phoneKey = lead.phone
        ? `phone:${lead.phone.replace(/\D/g, "")}`
        : null;
      const nameKey = `name:${(lead.name || "").toLowerCase().trim()}_${(
        lead.address || ""
      )
        .toLowerCase()
        .trim()}`;
      const key = phoneKey || nameKey;

      if (seen.has(key)) {
        const original = seen.get(key);
        duplicates.push({
          original: {
            id: original.id,
            name: original.name,
            phone: original.phone,
            address: original.address,
            campaignId: original.campaignId,
          },
          duplicate: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            address: lead.address,
            campaignId: lead.campaignId,
          },
          matchedBy: phoneKey ? "phone" : "name+address",
        });
      } else {
        seen.set(key, lead);
      }
    }

    res.json({
      duplicates,
      stats: {
        totalLeads: allLeads.length,
        campaigns: campaigns.length,
        duplicateCount: duplicates.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to update CSV file
function updateCsvFile(csvPath, leads) {
  const csvHeader =
    "ID,Name,Address,Phone,Rating,Website,Reference Link,Has Website,Possible Emails,Source,Scraped At\n";
  const csvRows = leads
    .map(
      (b) =>
        `${b.id},"${b.name || ""}","${b.address || ""}","${b.phone || ""}","${
          b.rating || ""
        }","${b.website || ""}","${b.referenceLink || ""}",${
          b.hasWebsite || false
        },"${(b.possibleEmails || []).join("; ")}","${b.source || ""}","${
          b.scrapedAt || ""
        }"`
    )
    .join("\n");

  fs.writeFileSync(csvPath, csvHeader + csvRows);
}

// Serve index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🌐 Business Leads Dashboard`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   Press Ctrl+C to stop\n`);
});
