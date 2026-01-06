const express = require("express");
const fs = require("fs");
const path = require("path");

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
      return res.json({ campaigns: 0, totalLeads: 0, withNotes: 0 });
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

    res.json({
      campaigns: campaigns.length,
      totalLeads,
      noWebsite,
      withNotes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
