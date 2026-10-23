/* ---------- Multi-portfolio state ---------- */
let portfolios = [];
let currentPortfolioId = null;
let holdings = [];
let realizedPL = 0;
let prices = {};
let prevPrices = {};

/** @type {'unknown'|'synced'|'local_only'|'error'|'saving'} */
let syncStatus = "unknown";
let syncErrorMessage = "";
let lastCloudSaveAt = null;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmt(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function uid() { return Date.now() + Math.random().toString(36).slice(2, 8); }

/** Empty portfolio for new accounts — no demo holdings (avoids cross-account lookalikes). */
function emptyPortfolios() {
  return [{
    id: uid(),
    name: "My Portfolio",
    transactions: [],
    watchlist: [],
    alerts: [],
    dividends: [],
  }];
}

const SCHEMA_VERSION = 2;

function migratePortfolios(fromVersion, data) {
  if (!Array.isArray(data)) return emptyPortfolios();
  return data.map((p) => ({
    ...p,
    transactions: Array.isArray(p.transactions) ? p.transactions : [],
    watchlist: Array.isArray(p.watchlist) ? p.watchlist : [],
    alerts: Array.isArray(p.alerts) ? p.alerts : [],
    dividends: Array.isArray(p.dividends) ? p.dividends : [],
  }));
}

function lsKey(name) { return `ee_${name}_${currentUserId}`; }

function setSyncStatus(status, message) {
  syncStatus = status;
  syncErrorMessage = message || "";
  if (typeof updateSyncBadgeUI === "function") updateSyncBadgeUI();
  if (typeof updateSecAuditUI === "function") updateSecAuditUI();
}

function updateSyncBadgeUI() {
  const el = document.getElementById("syncBadge");
  if (!el) return;
  const map = {
    unknown: { text: "Sync: …", cls: "sync-unknown" },
    saving: { text: "Sync: saving…", cls: "sync-saving" },
    synced: { text: "Sync: cloud", cls: "sync-ok" },
    local_only: { text: "Sync: local only", cls: "sync-warn" },
    error: { text: "Sync: error", cls: "sync-err" },
  };
  const m = map[syncStatus] || map.unknown;
  el.textContent = m.text;
  el.className = "sync-badge label " + m.cls;
  el.title = syncErrorMessage || (lastCloudSaveAt ? ("Last cloud save: " + lastCloudSaveAt) : "");
  const banner = document.getElementById("syncBanner");
  if (banner) {
    if (syncStatus === "error" || syncStatus === "local_only") {
      banner.style.display = "block";
      banner.textContent = syncErrorMessage ||
        "Cloud sync unavailable — this device keeps a local copy only. Export a backup. Fix Supabase portfolio_data + RLS to restore multi-device sync.";
      banner.className = "sync-banner " + (syncStatus === "error" ? "err" : "warn");
    } else {
      banner.style.display = "none";
    }
  }
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(lsKey("portfoliosV2"));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) portfolios = parsed;
    }
  } catch (e) {}
  try {
    currentPortfolioId = localStorage.getItem(lsKey("currentPortfolioId"));
  } catch (e) {}
}
function saveLocalCache() {
  if (!currentUserId) return;
  try {
    localStorage.setItem(lsKey("portfoliosV2"), JSON.stringify(portfolios));
    localStorage.setItem(lsKey("currentPortfolioId"), currentPortfolioId || "");
  } catch (e) {}
}

function formatSupabaseError(error) {
  if (!error) return "Unknown cloud error";
  const code = error.code || error.status || "";
  const msg = error.message || String(error);
  if (String(code) === "404" || /relation|does not exist|Not Found/i.test(msg)) {
    return "Cloud table portfolio_data missing or not exposed (HTTP 404). Run the SQL migration in Supabase.";
  }
  if (/permission|RLS|row-level|policy/i.test(msg)) {
    return "Cloud write blocked by RLS/permissions. Check policies on portfolio_data.";
  }
  return msg + (code ? " (" + code + ")" : "");
}

async function loadState() {
  loadLocalCache();
  setSyncStatus("unknown");

  if (!currentUserId) {
    if (!portfolios.length) portfolios = emptyPortfolios();
    setSyncStatus("local_only", "Not signed in.");
    return;
  }

  try {
    const { data, error } = await sb
      .from("portfolio_data")
      .select("portfolios, current_portfolio_id, schema_version, updated_at")
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (error) {
      console.error("portfolio_data load error:", error);
      if (!portfolios.length) portfolios = emptyPortfolios();
      setSyncStatus("error", formatSupabaseError(error));
    } else if (data && Array.isArray(data.portfolios) && data.portfolios.length) {
      portfolios = migratePortfolios(data.schema_version || 1, data.portfolios);
      currentPortfolioId = data.current_portfolio_id;
      setSyncStatus("synced", data.updated_at ? ("Loaded from cloud · " + data.updated_at) : "Loaded from cloud");
    } else {
      // No cloud row yet — keep local if present, else empty (not demo)
      if (!portfolios.length) portfolios = emptyPortfolios();
      setSyncStatus("synced", "No cloud row yet — will create on first save");
      // Push empty/local up so row exists
      saveState();
    }
  } catch (e) {
    console.error("portfolio_data load exception:", e);
    if (!portfolios.length) portfolios = emptyPortfolios();
    setSyncStatus("error", formatSupabaseError(e));
  }

  if (!currentPortfolioId || !portfolios.find((p) => p.id === currentPortfolioId)) {
    currentPortfolioId = portfolios[0].id;
  }
  saveLocalCache();
  updateSyncBadgeUI();
}

let _saveTimer = null;
function saveState() {
  saveLocalCache();
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    if (!currentUserId) return;
    setSyncStatus("saving");
    try {
      const { error } = await sb.from("portfolio_data").upsert({
        user_id: currentUserId,
        portfolios,
        current_portfolio_id: currentPortfolioId,
        schema_version: SCHEMA_VERSION,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (error) {
        console.error("Portfolio sync failed, kept locally:", error);
        setSyncStatus("error", formatSupabaseError(error));
      } else {
        lastCloudSaveAt = new Date().toISOString();
        setSyncStatus("synced", "Saved to cloud · " + lastCloudSaveAt);
      }
    } catch (e) {
      console.error("Portfolio sync failed, kept locally:", e);
      setSyncStatus("error", formatSupabaseError(e));
    }
  }, 400);
}

function getCurrentPortfolio() {
  const p = portfolios.find((p) => p.id === currentPortfolioId) || portfolios[0];
  if (p) {
    if (!Array.isArray(p.watchlist)) p.watchlist = [];
    if (!Array.isArray(p.alerts)) p.alerts = [];
    if (!Array.isArray(p.dividends)) p.dividends = [];
    if (!Array.isArray(p.transactions)) p.transactions = [];
  }
  return p;
}

function switchPortfolio(id) {
  currentPortfolioId = id;
  saveState();
  recompute();
  renderPortfolioTabs();
  refresh();
  renderTransactions();
  renderPerformancePanel();
  renderDividends();
  renderWatchlist();
  evaluateAlerts();
}

function createPortfolio() {
  appPrompt({
    title: "New Portfolio",
    placeholder: "Portfolio name",
    defaultValue: "New Portfolio",
    confirmText: "Create",
    onSubmit: (name) => {
      const p = { id: uid(), name: name.trim(), transactions: [], watchlist: [], alerts: [], dividends: [] };
      portfolios.push(p);
      switchPortfolio(p.id);
    },
  });
}

function renamePortfolioTo(name) {
  if (!name || !name.trim()) return;
  const p = getCurrentPortfolio();
  p.name = name.trim();
  saveState();
  renderPortfolioTabs();
}

function autoBackupBeforeDestruction(reason) {
  try {
    const payload = {
      app: "NEPSE Portfolio",
      exportedAt: new Date().toISOString(),
      reason,
      portfolios,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `nepse-portfolio-autobackup-${reason}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Auto-backup failed:", e);
  }
}

function deleteCurrentPortfolio() {
  if (portfolios.length <= 1) {
    appAlert({ title: "Can't delete", message: "You need at least one portfolio — clear its data instead if you want to reset it." });
    return;
  }
  const p = getCurrentPortfolio();
  appConfirm({
    title: "Delete portfolio?",
    message: `Delete portfolio "${p.name}" and all its transactions? A backup file will download automatically first.`,
    confirmText: "Delete",
    danger: true,
    onConfirm: () => {
      autoBackupBeforeDestruction("pre-delete");
      portfolios = portfolios.filter((x) => x.id !== p.id);
      currentPortfolioId = portfolios[0].id;
      saveState();
      recompute();
      renderPortfolioTabs();
      refresh();
      renderTransactions();
      renderPerformancePanel();
      renderDividends();
    },
  });
}

function clearCurrentPortfolioData() {
  const p = getCurrentPortfolio();
  appConfirm({
    title: "Clear portfolio data?",
    message: `Clear all holdings, transactions, watchlist, alerts, and dividends for "${p.name}"? A backup file will download automatically first.`,
    confirmText: "Clear",
    danger: true,
    onConfirm: () => {
      autoBackupBeforeDestruction("pre-clear");
      p.transactions = [];
      p.watchlist = [];
      p.alerts = [];
      p.dividends = [];
      saveState();
      recompute();
      refresh();
      renderTransactions();
      renderPerformancePanel();
      renderDividends();
      renderWatchlist();
      evaluateAlerts();
    },
  });
}

function recompute() {
  const p = getCurrentPortfolio();
  const trades = (p.transactions || []).filter((t) => t.symbol && t.side && t.qty > 0 && t.price >= 0);
  const { holdings: bySymbol, realizedPL: rpl } = buildHoldingsFromTrades(trades);
  const prevById = {};
  holdings.forEach((h) => { prevById[h.symbol] = h.id; });
  holdings = Object.values(bySymbol).map((h) => ({
    id: prevById[h.symbol] || h.symbol,
    symbol: h.symbol,
    qty: h.qty,
    avgCost: h.avgCost,
    purchaseDate: h.purchaseDate,
  }));
  realizedPL = rpl;
  const label = document.getElementById("portfolioNameLabel");
  if (label) label.textContent = p.name;
}

function getRates() {
  return {
    lt: Number(document.getElementById("ltRate").value) / 100,
    st: Number(document.getElementById("stRate").value) / 100,
    thresholdDays: Number(document.getElementById("holdingThreshold").value),
  };
}

function holdingDays(purchaseDate, endDate) {
  if (!purchaseDate) return null;
  const then = new Date(purchaseDate);
  const now = endDate ? new Date(endDate) : new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function holdingTermLabel(days) {
  const rates = getRates();
  if (days === null || days === undefined || Number.isNaN(days)) return "—";
  return days > rates.thresholdDays ? "Long-term" : "Short-term";
}

/** Stable key for import dedup */
function txDedupeKey(t) {
  return [String(t.symbol || "").toUpperCase(), String(t.side || "").toLowerCase(), Number(t.qty), Number(t.price), t.date || ""].join("|");
}
