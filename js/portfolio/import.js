/* ---------- Import: CSV/XLSX parsing ---------- */
function normHeader(h) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const splitLine = (line) => {
    const out = []; let cur = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === "," && !inQuotes) { out.push(cur.trim()); cur = ""; }
      else { cur += c; }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = splitLine(lines[0]).map(normHeader);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i]; });
    return obj;
  });
}

function parseXLSX(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  let allRows = [];
  wb.SheetNames.forEach((name) => {
    const sheet = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    raw.forEach((row) => {
      const obj = {};
      Object.keys(row).forEach((k) => { obj[normHeader(k)] = row[k]; });
      allRows.push(obj);
    });
  });
  return allRows;
}

function findKey(obj, candidates) {
  const keys = Object.keys(obj);
  for (const c of candidates) {
    const hit = keys.find((k) => k.includes(c));
    if (hit) return hit;
  }
  return null;
}

function num(v) {
  if (v === null || v === undefined) return NaN;
  return parseFloat(String(v).replace(/,/g, "").trim());
}

function detectFormat(rows) {
  if (!rows.length) return "unknown";
  const keys = Object.keys(rows[0]);
  const has = (c) => keys.some((k) => k.includes(c));
  if (has("buysell") && has("tradeqty") && (has("pricenpr") || has("price"))) return "tms";
  if (has("creditquantity") && has("debitquantity")) return "meroshare-history";
  if (has("wacc") || (has("scrip") && has("balance"))) return "wacc";
  return "unknown";
}

function dateFromTradeId(tradeId) {
  const s = String(tradeId || "");
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function extractTmsTrades(rows) {
  return rows.map((r) => {
    const symKey = findKey(r, ["symbol", "scrip"]);
    const sideKey = findKey(r, ["buysell"]);
    const qtyKey = findKey(r, ["tradeqty", "quantity", "qty"]);
    const priceKey = findKey(r, ["pricenpr", "price"]);
    const idKey = findKey(r, ["exchangetradeid", "tradeid"]);
    const feesKey = findKey(r, ["totalcommission", "commission", "brokercharge", "sebonfee", "totalcharge", "charges"]);
    const clientIdKey = findKey(r, ["client"]) && !findKey(r, ["clientname"]) ? findKey(r, ["client"]) : findKey(r, ["clientid"]);
    const clientNameKey = findKey(r, ["clientname", "name"]);
    const symbol = symKey ? String(r[symKey] || "").toUpperCase().trim() : null;
    const side = sideKey ? String(r[sideKey] || "").toLowerCase().trim() : null;
    const qty = qtyKey ? num(r[qtyKey]) : NaN;
    const price = priceKey ? num(r[priceKey]) : NaN;
    const date = idKey ? dateFromTradeId(r[idKey]) : null;
    const clientId = clientIdKey ? String(r[clientIdKey] || "").trim() : "";
    const clientName = clientNameKey ? String(r[clientNameKey] || "").trim() : "";
    const feesRaw = feesKey ? num(r[feesKey]) : NaN;
    const fees = Number.isNaN(feesRaw) ? null : feesRaw;
    return { symbol, side, qty, price, date, clientId, clientName, fees };
  }).filter((t) => t.symbol && t.side && !Number.isNaN(t.qty) && !Number.isNaN(t.price));
}

function extractMeroshareHistory(rows) {
  return rows.map((r) => {
    const symKey = findKey(r, ["scrip", "symbol"]);
    const crKey = findKey(r, ["creditquantity"]);
    const drKey = findKey(r, ["debitquantity"]);
    const dateKey = findKey(r, ["transactiondate", "date"]);
    const balKey = findKey(r, ["balanceaftertransaction", "balance"]);
    const symbol = symKey ? String(r[symKey] || "").toUpperCase().trim() : null;
    const cr = crKey ? num(r[crKey]) : NaN;
    const dr = drKey ? num(r[drKey]) : NaN;
    const date = dateKey ? String(r[dateKey] || "").trim() : null;
    const balance = balKey ? num(r[balKey]) : NaN;
    return { symbol, cr: Number.isNaN(cr) ? 0 : cr, dr: Number.isNaN(dr) ? 0 : dr, date, balance };
  }).filter((t) => t.symbol);
}

function buildFIFOAnalysis(trades) {
  const indexed = trades.map((t, i) => ({ t, i }));
  indexed.sort((a, b) => {
    const d = (a.t.date || "").localeCompare(b.t.date || "");
    if (d !== 0) return d;
    return a.i - b.i;
  });

  const bySymbol = {};
  const lotRegistry = {};
  let realizedPL = 0;
  let realizedNetPL = 0;
  let hasAnyNetData = false;
  const perTransaction = {};

  indexed.forEach(({ t }) => {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = [];
    const lots = bySymbol[t.symbol];

    if (t.side.startsWith("b")) {
      const lot = { qty: t.qty, price: t.price, date: t.date, transactionId: t.id, originalQty: t.qty };
      lots.push(lot);
      lotRegistry[t.id] = lot;
      perTransaction[t.id] = {
        transactionId: t.id,
        symbol: t.symbol,
        side: "buy",
        qty: t.qty,
        price: t.price,
        date: t.date,
        costBasis: t.qty * t.price,
        proceeds: null,
        realizedPL: null,
        realizedPLPercent: null,
        matches: [],
      };
    } else if (t.side.startsWith("s")) {
      let remaining = t.qty;
      const matches = [];
      let costBasis = 0;
      while (remaining > 0 && lots.length) {
        const lot = lots[0];
        const take = Math.min(lot.qty, remaining);
        const cost = take * lot.price;
        const proceeds = take * t.price;
        const matchPL = proceeds - cost;
        const holdDays = holdingDays(lot.date, t.date);
        realizedPL += matchPL;
        costBasis += cost;
        matches.push({
          buyTransactionId: lot.transactionId,
          buyDate: lot.date,
          buyPrice: lot.price,
          sellDate: t.date,
          qty: take,
          cost,
          proceeds,
          realizedPL: matchPL,
          realizedPLPercent: cost > 0 ? (matchPL / cost) * 100 : 0,
          holdingDays: holdDays,
          holdingTerm: holdingTermLabel(holdDays),
        });
        lot.qty -= take;
        remaining -= take;
        if (lot.qty <= 0) lots.shift();
      }
      const proceedsTotal = (t.qty - remaining) * t.price;
      const totalPL = proceedsTotal - costBasis;

      const feesVal = (t.fees !== undefined && t.fees !== null && !Number.isNaN(Number(t.fees))) ? Number(t.fees) : null;
      let netProceeds = null, netPL = null;
      if (feesVal !== null) {
        hasAnyNetData = true;
        netProceeds = proceedsTotal - feesVal;
        netPL = netProceeds - costBasis;
        realizedNetPL += netPL;
      }

      perTransaction[t.id] = {
        transactionId: t.id,
        symbol: t.symbol,
        side: "sell",
        qty: t.qty,
        price: t.price,
        date: t.date,
        costBasis,
        proceeds: proceedsTotal,
        fees: feesVal,
        netProceeds,
        realizedPL: totalPL,
        netRealizedPL: netPL,
        realizedPLPercent: costBasis > 0 ? (totalPL / costBasis) * 100 : 0,
        matches,
        unmatchedQty: remaining > 0 ? remaining : 0,
      };
    }
  });

  const result = {};
  Object.keys(bySymbol).forEach((symbol) => {
    const lots = bySymbol[symbol].filter((l) => l.qty > 0);
    if (!lots.length) return;
    const qty = lots.reduce((s, l) => s + l.qty, 0);
    const cost = lots.reduce((s, l) => s + l.qty * l.price, 0);
    const avgCost = cost / qty;
    const purchaseDate = lots.reduce((min, l) => (!min || l.date < min ? l.date : min), null);
    result[symbol] = { symbol, qty, avgCost, purchaseDate };
  });

  const lotStatus = Object.values(lotRegistry).map((lot) => {
    const matchedQty = lot.originalQty - lot.qty;
    const remainingQty = lot.qty;
    const originalCost = lot.originalQty * lot.price;
    const remainingCost = remainingQty * lot.price;
    let status = "OPEN";
    if (matchedQty > 0 && remainingQty > 0) status = "PARTIALLY SOLD";
    else if (matchedQty > 0 && remainingQty <= 0) status = "FULLY SOLD";
    return {
      transactionId: lot.transactionId,
      symbol: null,
      buyDate: lot.date,
      price: lot.price,
      originalQty: lot.originalQty,
      matchedQty,
      remainingQty,
      originalCost,
      remainingCost,
      status,
    };
  });

  return { holdings: result, realizedPL, realizedNetPL: hasAnyNetData ? realizedNetPL : null, hasAnyNetData, perTransaction, lotStatus };
}

function buildHoldingsFromTrades(trades) {
  const { holdings, realizedPL } = buildFIFOAnalysis(trades);
  return { holdings, realizedPL };
}

function getDistinctClients(tmsTrades) {
  const map = new Map();
  tmsTrades.forEach((t) => {
    if (!t.clientId && !t.clientName) return;
    const key = t.clientId || t.clientName;
    if (!map.has(key)) map.set(key, { id: t.clientId, name: t.clientName });
  });
  return Array.from(map.values());
}

let pendingTmsTrades = [];
let pendingMeroshareRows = [];
let pendingWaccRows = [];

function finalizeImport(selectedClientId) {
  const status = document.getElementById("importStatus");
  let trades = pendingTmsTrades;
  if (selectedClientId) {
    trades = trades.filter((t) => (t.clientId || t.clientName) === selectedClientId);
  }

  const { holdings: fromTrades } = buildHoldingsFromTrades(trades);
  const notes = [];

  const bySymbolWacc = {};
  pendingWaccRows.forEach((r) => {
    const symKey = findKey(r, ["scrip", "symbol", "script"]);
    const qtyKey = findKey(r, ["currentbalance", "quantity", "qty", "balance"]);
    const waccKey = findKey(r, ["waccrate", "wacc", "avgcost", "avgrate", "purchaserate", "purchaseprice"]);
    const dateKey = findKey(r, ["purchasedate", "date"]);
    const symbol = symKey ? (r[symKey] || "").toUpperCase().trim() : null;
    if (!symbol) return;
    if (!bySymbolWacc[symbol]) bySymbolWacc[symbol] = { symbol, qty: null, avgCost: null, purchaseDate: null };
    if (qtyKey && r[qtyKey]) { const q = num(r[qtyKey]); if (!Number.isNaN(q)) bySymbolWacc[symbol].qty = q; }
    if (waccKey && r[waccKey]) { const w = num(r[waccKey]); if (!Number.isNaN(w)) bySymbolWacc[symbol].avgCost = w; }
    if (dateKey && r[dateKey]) { const d = new Date(r[dateKey]); if (!isNaN(d)) bySymbolWacc[symbol].purchaseDate = d.toISOString().slice(0, 10); }
  });

  const merged = { ...bySymbolWacc };
  Object.keys(fromTrades).forEach((sym) => { merged[sym] = fromTrades[sym]; });

  const meroshareBalanceBySymbol = {};
  pendingMeroshareRows.forEach((r) => {
    meroshareBalanceBySymbol[r.symbol] = r;
  });
  Object.keys(meroshareBalanceBySymbol).forEach((sym) => {
    if (!merged[sym]) {
      merged[sym] = { symbol: sym, qty: null, avgCost: null, purchaseDate: null };
      notes.push(`${sym}: appears in transaction history but not in the trade book (e.g. bonus/rights/IPO) — set qty & avg cost manually.`);
    }
  });

  const finalRows = Object.values(merged).filter((h) => h.qty);
  const missingCost = finalRows.filter((h) => !h.avgCost);
  const usable = finalRows.filter((h) => h.qty && h.avgCost);

  if (finalRows.length === 0) {
    status.className = "import-status err";
    if (pendingMeroshareRows.length && !trades.length && !pendingWaccRows.length) {
      const seenSymbols = [...new Set(pendingMeroshareRows.map((r) => r.symbol))].join(", ");
      status.textContent = `Found transaction history for ${seenSymbols || "your holdings"}, but it only has quantities — no prices — so avg cost can't be calculated from it alone. Also drop in your TMS Trade Book export (it has Buy/Sell prices) so holdings can be built, or add these manually below.`;
    } else {
      status.textContent = "Couldn't find recognizable columns in the file(s). Check the format or try manual entry below.";
    }
    return;
  }

  const p = getCurrentPortfolio();
  const symbolsFromTradeBook = new Set(Object.keys(fromTrades));

  trades.forEach((t) => {
    p.transactions.push({ id: uid(), symbol: t.symbol, side: t.side.startsWith("b") ? "buy" : "sell", qty: t.qty, price: t.price, date: t.date, fees: t.fees ?? null, note: "Trade Book import" });
  });

  usable.forEach((m) => {
    if (symbolsFromTradeBook.has(m.symbol)) return;
    p.transactions.push({ id: uid(), symbol: m.symbol, side: "buy", qty: m.qty, price: m.avgCost, date: m.purchaseDate, fees: null, note: "Opening balance (imported)" });
  });

  status.className = "import-status ok";
  let msg = `Imported ${usable.length} holding(s): ${usable.map((m) => m.symbol).join(", ")}.`;
  if (missingCost.length) msg += ` ${missingCost.length} symbol(s) need manual qty/cost — add them in Transactions: ${missingCost.map((m) => m.symbol).join(", ")}.`;
  if (notes.length) msg += " " + notes.join(" ");
  status.textContent = msg;

  document.getElementById("clientPicker").style.display = "none";
  pendingTmsTrades = []; pendingMeroshareRows = []; pendingWaccRows = [];
  saveState();
  recompute();
  refresh();
  renderTransactions();
  renderPerformancePanel();
  renderDividends();
}

function handleFiles(fileList) {
  const status = document.getElementById("importStatus");
  status.className = "import-status";
  status.textContent = "Reading files…";
  document.getElementById("clientPicker").style.display = "none";

  const files = Array.from(fileList);
  const readers = files.map((f) => {
    const isXlsx = /\.xlsx?$/i.test(f.name);
    return isXlsx
      ? f.arrayBuffer().then((buf) => ({ rows: parseXLSX(buf), isXlsx: true }))
      : f.text().then((t) => ({ rows: parseCSV(t), isXlsx: false }));
  });

  Promise.all(readers).then((results) => {
    pendingTmsTrades = []; pendingMeroshareRows = []; pendingWaccRows = [];

    results.forEach(({ rows }) => {
      const fmt = detectFormat(rows);
      if (fmt === "tms") {
        pendingTmsTrades = pendingTmsTrades.concat(extractTmsTrades(rows));
      } else if (fmt === "meroshare-history") {
        pendingMeroshareRows = pendingMeroshareRows.concat(extractMeroshareHistory(rows));
      } else if (fmt === "wacc") {
        pendingWaccRows = pendingWaccRows.concat(rows);
      }
    });

    if (!pendingTmsTrades.length && !pendingMeroshareRows.length && !pendingWaccRows.length) {
      status.className = "import-status err";
      status.textContent = "Couldn't detect a known format (Trade Book, Transaction History, or Share Values/WACC CSV). Check the file or try manual entry below.";
      return;
    }

    const clients = getDistinctClients(pendingTmsTrades);
    if (clients.length > 1) {
      const picker = document.getElementById("clientPicker");
      const select = document.getElementById("clientSelect");
      select.innerHTML = "";
      clients.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id || c.name;
        opt.textContent = c.name ? `${c.name} (${c.id})` : c.id;
        select.appendChild(opt);
      });
      picker.style.display = "block";
      status.textContent = `Trade book has ${clients.length} clients — pick one above to import.`;
      return;
    }

    finalizeImport(clients.length === 1 ? (clients[0].id || clients[0].name) : null);
  }).catch((err) => {
    status.className = "import-status err";
    status.textContent = "Something went wrong reading those files.";
    console.error(err);
  });
}

document.getElementById("clientImportBtn").addEventListener("click", () => {
  const select = document.getElementById("clientSelect");
  finalizeImport(select.value);
});

let staleSymbols = new Set();

async function fetchOne(workerUrl, symbol, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${workerUrl}/?symbol=${encodeURIComponent(symbol)}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${symbol}: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function refresh() {
  const errorBox = document.getElementById("errorBox");
  errorBox.style.display = "none";
  const p = getCurrentPortfolio();
  const holdingSyms = holdings.map((h) => h.symbol);
  const watchSyms = (p?.watchlist || []).map((w) => w.symbol);
  const alertSyms = (p?.alerts || []).map((a) => a.symbol).filter(Boolean);
  const allSymbols = Array.from(new Set([...holdingSyms, ...watchSyms, ...alertSyms].filter(Boolean)));

  if (allSymbols.length === 0) {
    render();
    renderWatchlist();
    evaluateAlerts();
    return;
  }
  const workerUrl = getWorkerUrl();

  const settled = await Promise.allSettled(
    allSymbols.map((s) => fetchOne(workerUrl, s))
  );

  prevPrices = { ...prices };
  const next = { ...prices };
  const failedSymbols = [];
  const newStale = new Set();

  settled.forEach((result, i) => {
    const symbol = allSymbols[i];
    if (result.status === "fulfilled" && result.value && result.value.symbol) {
      next[result.value.symbol] = result.value;
    } else {
      failedSymbols.push(symbol);
      if (next[symbol]) newStale.add(symbol);
    }
  });

  prices = next;
  staleSymbols = newStale;

  if (failedSymbols.length === 0) {
    errorBox.style.display = "none";
    document.getElementById("lastUpdated").textContent = new Date().toLocaleTimeString() + " · refreshes every 30s";
  } else if (failedSymbols.length === allSymbols.length) {
    errorBox.textContent = "Couldn't reach the price feed. Showing last known prices — check the Worker URL in settings.";
    errorBox.style.display = "block";
  } else {
    errorBox.textContent = `Couldn't refresh: ${failedSymbols.join(", ")}. Showing last known price for ${failedSymbols.length === 1 ? "it" : "them"}.`;
    errorBox.style.display = "block";
    document.getElementById("lastUpdated").textContent = new Date().toLocaleTimeString() + " · refreshes every 30s (partial)";
  }
  render();
  renderUnrealizedPanel();
  renderWatchlist();
  evaluateAlerts();
  if (typeof renderHealthPanel === "function") renderHealthPanel();
  if (typeof renderTopPerformers === "function") renderTopPerformers();
}


function openImportModal() {
  document.getElementById("importModalOverlay").classList.add("show");
}
function closeImportModal() {
  document.getElementById("importModalOverlay").classList.remove("show");
}
document.getElementById("importBtn").addEventListener("click", openImportModal);
document.getElementById("importModalClose").addEventListener("click", closeImportModal);
document.getElementById("importModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "importModalOverlay") closeImportModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("importModalOverlay").classList.contains("show")) closeImportModal();
});

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFiles(e.target.files));
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

["ltRate", "stRate", "holdingThreshold"].forEach((id) => {
  document.getElementById(id).addEventListener("input", render);
});

document.getElementById("addBtn").addEventListener("click", () => {
  const symbol = document.getElementById("symbolInput").value.trim().toUpperCase();
  const qty = Number(document.getElementById("qtyInput").value);
  const costRaw = document.getElementById("costInput").value;
  const cost = Number(costRaw);
  const date = document.getElementById("dateInput").value || null;
  if (!symbol || !qty || qty <= 0 || costRaw === "" || Number.isNaN(cost) || cost < 0) {
    appAlert({ title: "Missing info", message: "Enter a valid symbol, quantity, and avg cost (0 is allowed for bonus shares)." });
    return;
  }
  const p = getCurrentPortfolio();
  p.transactions.push({ id: uid(), symbol, side: "buy", qty, price: cost, date, fees: null, note: "" });
  saveState();
  recompute();
  document.getElementById("symbolInput").value = "";
  document.getElementById("qtyInput").value = "";
  document.getElementById("costInput").value = "";
  document.getElementById("dateInput").value = "";
  refresh();
  renderTransactions();
  renderPerformancePanel();
  renderDividends();
});
