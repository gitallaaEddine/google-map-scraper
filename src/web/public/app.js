// State
let campaigns = [];
let currentCampaign = null;
let leads = [];
let filteredLeads = [];
let editingLead = null;
let trashItems = [];
let duplicateItems = [];

// DOM Elements
const campaignList = document.getElementById("campaign-list");
const leadsBody = document.getElementById("leads-body");
const campaignTitle = document.getElementById("campaign-title");
const filters = document.getElementById("filters");
const leadsCount = document.getElementById("leads-count");
const modal = document.getElementById("edit-modal");
const trashModal = document.getElementById("trash-modal");
const duplicatesModal = document.getElementById("duplicates-modal");

// Dark Mode
function initDarkMode() {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.body.classList.add("dark-mode");
    updateThemeIcon(true);
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.querySelector(".theme-icon");
  if (icon) {
    icon.textContent = isDark ? "☀️" : "🌙";
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();
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
    document.getElementById("stat-trash").textContent = stats.inTrash || 0;
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
      '<tr><td colspan="8" class="loading">Loading leads</td></tr>';

    const res = await fetch(`/api/campaigns/${campaignId}/leads`);
    leads = await res.json();

    applyFilters();
  } catch (error) {
    console.error("Error loading leads:", error);
    leadsBody.innerHTML =
      '<tr><td colspan="8" class="empty-state">Error loading leads</td></tr>';
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
      '<tr><td colspan="8" class="empty-state">No leads match your filters</td></tr>';
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
            : '<span class="empty-value">—</span>'
        }
      </td>
      <td class="lead-rating ${getRatingClass(lead.rating)}">
        ${
          lead.rating
            ? `⭐ ${lead.rating}`
            : '<span class="empty-value">—</span>'
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
        ${
          lead.referenceLink
            ? `<a href="${escapeHtml(
                lead.referenceLink
              )}" target="_blank" class="maps-badge">📍 View</a>`
            : '<span class="empty-value">—</span>'
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

// ==================== DELETE & TRASH FUNCTIONS ====================

// Delete lead (move to trash)
async function deleteLead() {
  if (!editingLead || !currentCampaign) return;

  if (
    !confirm(
      `Are you sure you want to delete "${editingLead.name}"?\n\nThis lead will be moved to trash and won't appear in future scrapes.`
    )
  ) {
    return;
  }

  try {
    const res = await fetch(
      `/api/campaigns/${currentCampaign.id}/leads/${editingLead.id}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      // Remove from local data
      leads = leads.filter((l) => l.id !== editingLead.id);
      applyFilters();
      closeModal();
      loadStats();
    } else {
      const error = await res.json();
      alert("Error deleting lead: " + error.error);
    }
  } catch (error) {
    console.error("Error deleting lead:", error);
    alert("Error deleting lead");
  }
}

// Show trash modal
async function showTrash() {
  try {
    const res = await fetch("/api/trash");
    const data = await res.json();
    trashItems = data.leads || [];

    renderTrash();
    trashModal.classList.add("open");
  } catch (error) {
    console.error("Error loading trash:", error);
    alert("Error loading trash");
  }
}

// Render trash items
function renderTrash() {
  const trashList = document.getElementById("trash-list");
  const trashActions = document.getElementById("trash-actions");

  if (trashItems.length === 0) {
    trashList.innerHTML = '<div class="empty-state">🗑️ Trash is empty</div>';
    trashActions.style.display = "none";
    return;
  }

  trashActions.style.display = "block";
  trashList.innerHTML = trashItems
    .map(
      (item, index) => `
    <div class="trash-item">
      <div class="trash-item-info">
        <div class="trash-item-name">${escapeHtml(item.name)}</div>
        <div class="trash-item-meta">
          ${item.phone ? `📞 ${escapeHtml(item.phone)}` : ""}
          ${
            item.address
              ? `📍 ${escapeHtml(item.address.substring(0, 40))}...`
              : ""
          }
        </div>
        <div class="trash-item-date">Deleted: ${formatDate(
          item.deletedAt
        )}</div>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-primary btn-small" onclick="restoreFromTrash(${
          item.trashIndex
        })">↩️ Restore</button>
        <button class="btn btn-danger btn-small" onclick="permanentlyDelete(${
          item.trashIndex
        })">🗑️ Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

// Restore lead from trash
async function restoreFromTrash(trashIndex) {
  try {
    const res = await fetch(`/api/trash/${trashIndex}/restore`, {
      method: "POST",
    });

    if (res.ok) {
      // Reload trash
      await showTrash();
      loadStats();

      // Reload current campaign if it matches
      if (currentCampaign) {
        await selectCampaign(currentCampaign.id);
      }
    } else {
      const error = await res.json();
      alert("Error restoring lead: " + error.error);
    }
  } catch (error) {
    console.error("Error restoring lead:", error);
    alert("Error restoring lead");
  }
}

// Permanently delete from trash
async function permanentlyDelete(trashIndex) {
  const item = trashItems.find((t) => t.trashIndex === trashIndex);
  if (
    !confirm(
      `Permanently delete "${item?.name}"?\n\nThis cannot be undone, but the lead will still be blacklisted from future scrapes.`
    )
  ) {
    return;
  }

  try {
    const res = await fetch(`/api/trash/${trashIndex}`, {
      method: "DELETE",
    });

    if (res.ok) {
      await showTrash();
      loadStats();
    } else {
      const error = await res.json();
      alert("Error deleting: " + error.error);
    }
  } catch (error) {
    console.error("Error permanently deleting:", error);
    alert("Error deleting");
  }
}

// Empty entire trash
async function emptyTrash() {
  if (
    !confirm(
      "Empty the entire trash?\n\nAll items will be permanently deleted. They will still be blacklisted from future scrapes."
    )
  ) {
    return;
  }

  try {
    const res = await fetch("/api/trash", { method: "DELETE" });

    if (res.ok) {
      await showTrash();
      loadStats();
    } else {
      const error = await res.json();
      alert("Error emptying trash: " + error.error);
    }
  } catch (error) {
    console.error("Error emptying trash:", error);
    alert("Error emptying trash");
  }
}

// Close trash modal
function closeTrashModal() {
  trashModal.classList.remove("open");
}

// ==================== DUPLICATES FUNCTIONS ====================

// Scan for duplicates
async function scanDuplicates() {
  try {
    document.getElementById("duplicates-stats").innerHTML =
      '<div class="loading">Scanning for duplicates...</div>';
    document.getElementById("duplicates-list").innerHTML = "";
    duplicatesModal.classList.add("open");

    const res = await fetch("/api/duplicates");
    const data = await res.json();
    duplicateItems = data.duplicates || [];

    renderDuplicates(data.stats);
  } catch (error) {
    console.error("Error scanning duplicates:", error);
    document.getElementById("duplicates-stats").innerHTML =
      '<div class="empty-state">Error scanning for duplicates</div>';
  }
}

// Render duplicates
function renderDuplicates(stats) {
  const statsDiv = document.getElementById("duplicates-stats");
  const listDiv = document.getElementById("duplicates-list");

  statsDiv.innerHTML = `
    <div class="stats-summary">
      <span>📊 Scanned <strong>${stats.campaigns}</strong> campaigns, <strong>${
    stats.totalLeads
  }</strong> leads</span>
      <span class="${stats.duplicateCount > 0 ? "warning" : "success"}">
        ${
          stats.duplicateCount > 0
            ? `⚠️ Found <strong>${stats.duplicateCount}</strong> duplicate(s)`
            : "✅ No duplicates found!"
        }
      </span>
      ${
        duplicateItems.length > 0
          ? `
        <button class="btn btn-danger" onclick="deleteAllDuplicates()">
          🗑️ Delete All Duplicates (${duplicateItems.length})
        </button>
      `
          : ""
      }
    </div>
  `;

  if (duplicateItems.length === 0) {
    listDiv.innerHTML =
      '<div class="empty-state">🎉 Your data is clean! No duplicates found.</div>';
    return;
  }

  listDiv.innerHTML = duplicateItems
    .map(
      (dup, index) => `
    <div class="duplicate-item">
      <div class="duplicate-header">
        <span class="duplicate-name">${escapeHtml(dup.duplicate.name)}</span>
        <span class="duplicate-match">Matched by: ${dup.matchedBy}</span>
      </div>
      <div class="duplicate-details">
        <div class="duplicate-entry original">
          <div class="entry-header">
            <span class="entry-label">📁 Original:</span>
            <span class="entry-campaign">${formatCampaignName(
              dup.original.campaignId
            )}</span>
          </div>
          <div class="entry-links">
            ${
              dup.original.website
                ? `<a href="${escapeHtml(
                    dup.original.website
                  )}" target="_blank" class="link-badge website">🌐 Website</a>`
                : '<span class="link-badge no-website">No Website</span>'
            }
            ${
              dup.original.referenceLink
                ? `<a href="${escapeHtml(
                    dup.original.referenceLink
                  )}" target="_blank" class="link-badge maps">📍 Maps</a>`
                : ""
            }
          </div>
        </div>
        <div class="duplicate-entry duplicate">
          <div class="entry-header">
            <span class="entry-label">📁 Duplicate:</span>
            <span class="entry-campaign">${formatCampaignName(
              dup.duplicate.campaignId
            )}</span>
          </div>
          <div class="entry-links">
            ${
              dup.duplicate.website
                ? `<a href="${escapeHtml(
                    dup.duplicate.website
                  )}" target="_blank" class="link-badge website">🌐 Website</a>`
                : '<span class="link-badge no-website">No Website</span>'
            }
            ${
              dup.duplicate.referenceLink
                ? `<a href="${escapeHtml(
                    dup.duplicate.referenceLink
                  )}" target="_blank" class="link-badge maps">📍 Maps</a>`
                : ""
            }
          </div>
        </div>
      </div>
      <div class="duplicate-info-row">
        ${
          dup.duplicate.phone
            ? `<span class="duplicate-info">📞 ${escapeHtml(
                dup.duplicate.phone
              )}</span>`
            : ""
        }
        ${
          dup.duplicate.address
            ? `<span class="duplicate-info">📍 ${escapeHtml(
                dup.duplicate.address
              )}</span>`
            : ""
        }
      </div>
      <div class="duplicate-actions">
        <button class="btn btn-danger btn-small" onclick="deleteDuplicate('${
          dup.duplicate.campaignId
        }', ${dup.duplicate.id}, ${index})">
          🗑️ Delete Duplicate
        </button>
        <button class="btn btn-secondary btn-small" onclick="keepBoth(${index})">
          ✓ Keep Both
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

// Format campaign name for display
function formatCampaignName(campaignId) {
  if (!campaignId) return "Unknown";
  return campaignId
    .replace("campaign_", "")
    .replace(/_\d+$/, "")
    .replace(/_/g, " ");
}

// Delete duplicate lead
async function deleteDuplicate(campaignId, leadId, index) {
  const dup = duplicateItems[index];
  if (
    !confirm(
      `Delete "${dup.duplicate.name}" from ${formatCampaignName(campaignId)}?`
    )
  ) {
    return;
  }

  try {
    const res = await fetch(`/api/campaigns/${campaignId}/leads/${leadId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      // Remove from list and re-render
      duplicateItems.splice(index, 1);
      renderDuplicates({
        campaigns: 0, // Will be ignored in re-render
        totalLeads: 0,
        duplicateCount: duplicateItems.length,
      });
      loadStats();

      // Reload current campaign if affected
      if (currentCampaign && currentCampaign.id === campaignId) {
        await selectCampaign(campaignId);
      }
    } else {
      const error = await res.json();
      alert("Error deleting: " + error.error);
    }
  } catch (error) {
    console.error("Error deleting duplicate:", error);
    alert("Error deleting duplicate");
  }
}

// Keep both (dismiss from list)
function keepBoth(index) {
  duplicateItems.splice(index, 1);
  renderDuplicates({
    campaigns: 0,
    totalLeads: 0,
    duplicateCount: duplicateItems.length,
  });
}

// Delete all duplicates at once
async function deleteAllDuplicates() {
  if (duplicateItems.length === 0) return;

  if (
    !confirm(
      `Are you sure you want to delete ALL ${duplicateItems.length} duplicate leads?\n\nThis will move them to trash.`
    )
  ) {
    return;
  }

  const errors = [];
  const toDelete = [...duplicateItems]; // Copy array since we'll modify original

  document.getElementById("duplicates-stats").innerHTML =
    '<div class="loading">Deleting duplicates... Please wait.</div>';

  for (const dup of toDelete) {
    try {
      const res = await fetch(
        `/api/campaigns/${dup.duplicate.campaignId}/leads/${dup.duplicate.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        errors.push(`${dup.duplicate.name}: ${error.error}`);
      }
    } catch (error) {
      errors.push(`${dup.duplicate.name}: ${error.message}`);
    }
  }

  // Clear all duplicates from list
  duplicateItems = [];

  if (errors.length > 0) {
    alert(
      `Deleted with ${errors.length} error(s):\n${errors
        .slice(0, 5)
        .join("\n")}${
        errors.length > 5 ? `\n...and ${errors.length - 5} more` : ""
      }`
    );
  }

  // Refresh
  renderDuplicates({
    campaigns: 0,
    totalLeads: 0,
    duplicateCount: 0,
  });
  loadStats();

  // Reload current campaign if open
  if (currentCampaign) {
    await selectCampaign(currentCampaign.id);
  }
}

// Close duplicates modal
function closeDuplicatesModal() {
  duplicatesModal.classList.remove("open");
}

// Close modal on outside click
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

trashModal.addEventListener("click", (e) => {
  if (e.target === trashModal) closeTrashModal();
});

duplicatesModal.addEventListener("click", (e) => {
  if (e.target === duplicatesModal) closeDuplicatesModal();
});

// Close modal on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeTrashModal();
    closeDuplicatesModal();
  }
});
