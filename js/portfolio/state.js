/* ---------- Multi-portfolio state ---------- */
let portfolios = [];
let currentPortfolioId = null;
let holdings = [];
let realizedPL = 0;
let prices = {};
let prevPrices = {};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmt(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function uid() { return Date.now() + Math.random().toString(36).slice(2, 8); }

function defaultPortfolios() {
  return [{
    id: uid(),
    name: "My Portfolio",
    transactions: [
      { id: uid(), symbol: "NABIL", side: "buy", qty: 50, price: 780, date: "2025-03-15", note: "" },
      { id: uid(), symbol: "NICA", side: "buy", qty: 100, price: 410, date: null, note: "" },
    ],
    watchlist: [
      { id: uid(), symbol: "CIT", targetPrice: 2200, targetType: "buy_below", note: "Accumulate on dip", createdAt: new Date().toISOString() },
      { id: uid(), symbol: "SHIVM", targetPrice: 560, targetType: "sell_above", note: "Resistance target", createdAt: new Date().toISOString() },
    ],
    alerts: [],
  }];
}

const SCHEMA_VERSION = 2;

function migratePortfolios(fromVersion, data) {
  return data;
}

function lsKey(name) { return `ee_${name}_${currentUserId}`; }

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
  try {
    localStorage.setItem(lsKey("portfoliosV2"), JSON.stringify(portfolios));
    localStorage.setItem(lsKey("currentPortfolioId"), currentPortfolioId || "");
  } catch (e) {}
}

async function loadState() {
  loadLocalCache();

  try {
    const { data, error } = await sb
      .from("portfolio_data")
      .select("portfolios, current_portfolio_id, schema_version")
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (!error && data && Array.isArray(data.portfolios) && data.portfolios.length) {
      portfolios = data.portfolios;
      currentPortfolioId = data.current_portfolio_id;
      const storedVersion = data.schema_version || 1;
      if (storedVersion < SCHEMA_VERSION) portfolios = migratePortfolios(storedVersion, portfolios);
    } else if (!portfolios.length) {
      portfolios = defaultPortfolios();
    }
  } catch (e) {
    if (!portfolios.length) portfolios = defaultPortfolios();
  }

  if (!currentPortfolioId || !portfolios.find((p) => p.id === currentPortfolioId)) {
    currentPortfolioId = portfolios[0].id;
  }
  saveLocalCache();
}

let _saveTimer = null;
function saveState() {
  saveLocalCache();
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    if (!currentUserId) return;
    try {
      await sb.from("portfolio_data").upsert({
        user_id: currentUserId,
        portfolios,
        current_portfolio_id: currentPortfolioId,
        schema_version: SCHEMA_VERSION,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch (e) {
      console.error("Portfolio sync failed, kept locally:", e);
    }
  }, 400);
}

function getCurrentPortfolio() {
  const p = portfolios.find((p) => p.id === currentPortfolioId) || portfolios[0];
  if (p) {
    if (!Array.isArray(p.watchlist)) p.watchlist = [];
    if (!Array.isArray(p.alerts)) p.alerts = [];
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
      const p = { id: uid(), name: name.trim(), transactions: [] };
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
    message: `Clear all holdings and transaction history for "${p.name}"? A backup file will download automatically first.`,
    confirmText: "Clear",
    danger: true,
    onConfirm: () => {
      autoBackupBeforeDestruction("pre-clear");
      p.transactions = [];
      saveState();
      recompute();
      refresh();
      renderTransactions();
      renderPerformancePanel();
      renderDividends();
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
  document.getElementById("portfolioNameLabel").textContent = p.name;
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

