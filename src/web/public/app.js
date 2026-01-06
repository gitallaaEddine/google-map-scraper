// State
let campaigns = [];
let currentCampaign = null;
let leads = [];
let filteredLeads = [];
let editingLead = null;

// DOM Elements
const campaignList = document.getElementById("campaign-list");
const leadsBody = document.getElementById("leads-body");
const campaignTitle = document.getElementById("campaign-title");
const filters = document.getElementById("filters");
const leadsCount = document.getElementById("leads-count");
const modal = document.getElementById("edit-modal");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadCampaigns();
  setupFilters();
});

// Load overall stats
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const stats = await res.json();

    document.getElementById("stat-campaigns").textContent = stats.campaigns;
    document.getElementById("stat-leads").textContent = stats.totalLeads;
    document.getElementById("stat-no-website").textContent = stats.noWebsite;
    document.getElementById("stat-notes").textContent = stats.withNotes;
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

// Load campaigns
async function loadCampaigns() {
  try {
    campaignList.innerHTML = '<div class="loading">Loading campaigns</div>';

    const res = await fetch("/api/campaigns");
    campaigns = await res.json();

    renderCampaigns();
  } catch (error) {
    console.error("Error loading campaigns:", error);
    campaignList.innerHTML =
      '<div class="empty-state">Error loading campaigns</div>';
  }
}

// Render campaigns
function renderCampaigns() {
  if (campaigns.length === 0) {
    campaignList.innerHTML =
      '<div class="empty-state">No campaigns yet. Run a scrape first!</div>';
    return;
  }

  campaignList.innerHTML = campaigns
    .map(
      (c) => `
    <div class="campaign-item ${
      currentCampaign?.id === c.id ? "active" : ""
    }" onclick="selectCampaign('${c.id}')">
      <div class="campaign-name">${escapeHtml(c.name)}</div>
      <div class="campaign-meta">
        <span>${c.leadCount} leads</span>
        <span>${formatDate(c.createdAt)}</span>
      </div>
    </div>
  `
    )
    .join("");
}

// Select campaign
async function selectCampaign(campaignId) {
  try {
    currentCampaign = campaigns.find((c) => c.id === campaignId);

    // Update UI
    renderCampaigns();
    campaignTitle.textContent = currentCampaign.name;
    filters.style.display = "flex";
    leadsCount.style.display = "block";

    // Load leads
    leadsBody.innerHTML =
      '<tr><td colspan="7" class="loading">Loading leads</td></tr>';

    const res = await fetch(`/api/campaigns/${campaignId}/leads`);
    leads = await res.json();

    applyFilters();
  } catch (error) {
    console.error("Error loading leads:", error);
    leadsBody.innerHTML =
      '<tr><td colspan="7" class="empty-state">Error loading leads</td></tr>';
  }
}

// Setup filter listeners
function setupFilters() {
  document
    .getElementById("filter-website")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filter-priority")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filter-note")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filter-search")
    .addEventListener("input", applyFilters);
  document
    .getElementById("filter-rating")
    .addEventListener("input", applyFilters);
}

// Apply filters
function applyFilters() {
  const websiteFilter = document.getElementById("filter-website").value;
  const priorityFilter = document.getElementById("filter-priority").value;
  const noteFilter = document.getElementById("filter-note").value;
  const searchFilter = document
    .getElementById("filter-search")
    .value.toLowerCase();
  const ratingFilter =
    parseFloat(document.getElementById("filter-rating").value) || 0;

  filteredLeads = leads.filter((lead) => {
    // Website filter
    if (websiteFilter === "yes" && !lead.hasWebsite) return false;
    if (websiteFilter === "no" && lead.hasWebsite) return false;

    // Priority filter
    if (priorityFilter !== "all" && lead.priority !== priorityFilter)
      return false;

    // Note filter
    if (noteFilter === "yes" && (!lead.note || !lead.note.trim())) return false;
    if (noteFilter === "no" && lead.note && lead.note.trim()) return false;

    // Search filter
    if (searchFilter && !lead.name.toLowerCase().includes(searchFilter))
      return false;

    // Rating filter
    const rating = parseFloat(lead.rating) || 0;
    if (ratingFilter > 0 && rating < ratingFilter) return false;

    return true;
  });

  renderLeads();
}

// Render leads table
function renderLeads() {
  document.getElementById("showing-count").textContent = filteredLeads.length;
  document.getElementById("total-count").textContent = leads.length;

  if (filteredLeads.length === 0) {
    leadsBody.innerHTML =
      '<tr><td colspan="7" class="empty-state">No leads match your filters</td></tr>';
    return;
  }

  leadsBody.innerHTML = filteredLeads
    .map(
      (lead) => `
    <tr>
      <td class="lead-name">
        <div>${escapeHtml(lead.name)}</div>
        <div class="address">${escapeHtml(lead.address || "")}</div>
      </td>
      <td class="lead-phone">
        ${
          lead.phone
            ? `<a href="tel:${lead.phone}">${escapeHtml(lead.phone)}</a>`
            : '<span style="color:#ccc">—</span>'
        }
      </td>
      <td class="lead-rating ${getRatingClass(lead.rating)}">
        ${
          lead.rating
            ? `⭐ ${lead.rating}`
            : '<span style="color:#ccc">—</span>'
        }
      </td>
      <td>
        ${
          lead.hasWebsite
            ? `<a href="${escapeHtml(
                lead.website
              )}" target="_blank" class="website-badge yes">🌐 Website</a>`
            : '<span class="website-badge no">No Website</span>'
        }
      </td>
      <td>
        <span class="priority-badge ${lead.priority}">${getPriorityLabel(
        lead.priority
      )}</span>
      </td>
      <td>
        <span class="note-preview ${!lead.note ? "empty" : ""}">
          ${
            lead.note
              ? escapeHtml(lead.note.substring(0, 30)) +
                (lead.note.length > 30 ? "..." : "")
              : "No note"
          }
        </span>
      </td>
      <td>
        <button class="btn btn-primary btn-small" onclick="openEditModal(${
          lead.id
        })">Edit</button>
      </td>
    </tr>
  `
    )
    .join("");
}

// Open edit modal
function openEditModal(leadId) {
  editingLead = leads.find((l) => l.id === leadId);
  if (!editingLead) return;

  document.getElementById("modal-title").textContent = "Edit Lead";
  document.getElementById("modal-lead-info").innerHTML = `
    <h4>${escapeHtml(editingLead.name)}</h4>
    <p>📍 ${escapeHtml(editingLead.address || "No address")}</p>
    <p>📞 ${escapeHtml(editingLead.phone || "No phone")}</p>
    ${
      editingLead.website
        ? `<p>🌐 <a href="${escapeHtml(
            editingLead.website
          )}" target="_blank">${escapeHtml(editingLead.website)}</a></p>`
        : ""
    }
  `;

  document.getElementById("edit-priority").value =
    editingLead.priority || "none";
  document.getElementById("edit-note").value = editingLead.note || "";

  modal.classList.add("open");
}

// Close modal
function closeModal() {
  modal.classList.remove("open");
  editingLead = null;
}

// Save lead
async function saveLead() {
  if (!editingLead || !currentCampaign) return;

  const priority = document.getElementById("edit-priority").value;
  const note = document.getElementById("edit-note").value;

  try {
    const res = await fetch(
      `/api/campaigns/${currentCampaign.id}/leads/${editingLead.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority, note }),
      }
    );

    if (res.ok) {
      // Update local data
      const index = leads.findIndex((l) => l.id === editingLead.id);
      if (index !== -1) {
        leads[index].priority = priority;
        leads[index].note = note;
      }

      applyFilters();
      closeModal();
      loadStats(); // Refresh stats
    }
  } catch (error) {
    console.error("Error saving lead:", error);
    alert("Error saving lead");
  }
}

// Helper functions
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getRatingClass(rating) {
  const num = parseFloat(rating) || 0;
  if (num >= 4.5) return "high";
  if (num >= 4.0) return "medium";
  return "low";
}

function getPriorityLabel(priority) {
  const labels = {
    critical: "🔴 Critical",
    high: "🟠 High",
    medium: "🟡 Medium",
    low: "🟢 Low",
    none: "⚪ None",
  };
  return labels[priority] || labels.none;
}

// Close modal on outside click
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// Close modal on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
