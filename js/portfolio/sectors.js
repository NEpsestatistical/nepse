const SECTOR_MAP = {
  NABIL: "Commercial Banks", NICA: "Commercial Banks", SANIMA: "Commercial Banks",
  SCB: "Commercial Banks", HBL: "Commercial Banks", EBL: "Commercial Banks",
  NIB: "Commercial Banks", NBL: "Commercial Banks", ADBL: "Commercial Banks",
  KBL: "Commercial Banks", MBL: "Commercial Banks", PCBL: "Commercial Banks",
  SBI: "Commercial Banks", SBL: "Commercial Banks", NMB: "Commercial Banks",
  CZBIL: "Commercial Banks", GBIME: "Commercial Banks", PRVU: "Commercial Banks",
  LSL: "Commercial Banks",
  MDB: "Development Banks", SADBL: "Development Banks", GBBL: "Development Banks",
  MLBL: "Development Banks", EDBL: "Development Banks", SHINE: "Development Banks",
  KSBBL: "Development Banks", JBBL: "Development Banks",
  GUFL: "Finance", MFIL: "Finance", GFCL: "Finance", NFS: "Finance",
  ICFC: "Finance", CFCL: "Finance", PFL: "Finance",
  CBBL: "Microfinance", DDBL: "Microfinance", ANLB: "Microfinance",
  SKBBL: "Microfinance", SMFDB: "Microfinance", FOWAD: "Microfinance",
  SWBBL: "Microfinance", NMFBS: "Microfinance", USLB: "Microfinance",
  NLIC: "Life Insurance", ALICL: "Life Insurance", LICN: "Life Insurance",
  NLICL: "Life Insurance", CLI: "Life Insurance", SJLIC: "Life Insurance",
  PMLI: "Life Insurance", RLI: "Life Insurance",
  NICL: "Non-Life Insurance", NIL: "Non-Life Insurance", PRIN: "Non-Life Insurance",
  SICL: "Non-Life Insurance", HEI: "Non-Life Insurance", NLG: "Non-Life Insurance",
  UPPER: "Hydropower", NHPC: "Hydropower", CHCL: "Hydropower", AKPL: "Hydropower",
  RADHI: "Hydropower", API: "Hydropower", HDHPC: "Hydropower", BPCL: "Hydropower",
  UMHL: "Hydropower", NGPL: "Hydropower", RURU: "Hydropower", SSHL: "Hydropower",
  UMRH: "Hydropower", GHL: "Hydropower", DHPL: "Hydropower",
  OHL: "Hotels & Tourism", TRH: "Hotels & Tourism", SHL: "Hotels & Tourism",
  CGH: "Hotels & Tourism",
  UNL: "Manufacturing", BNL: "Manufacturing", SHIVM: "Manufacturing",
  NIFRA: "Investment", CIT: "Investment", HIDCL: "Investment", NRN: "Investment",
  STC: "Trading", NTC: "Telecom",
};


const COMPANY_SYMBOL_MAP = {
  "SANIMA BANK": "SANIMA",
  "SANIMA BANK LIMITED": "SANIMA",
  "NABIL BANK": "NABIL",
  "NABIL BANK LIMITED": "NABIL",
  "NIC ASIA BANK": "NICA",
  "NIC ASIA BANK LIMITED": "NICA",
  "NMB BANK": "NMB",
  "NMB BANK LIMITED": "NMB",
  "HIMALAYAN BANK": "HBL",
  "HIMALAYAN BANK LIMITED": "HBL",
  "EVEREST BANK": "EBL",
  "EVEREST BANK LIMITED": "EBL",
  "GLOBAL IME BANK": "GBIME",
  "GLOBAL IME BANK LIMITED": "GBIME",
  "PRABHU BANK": "PRVU",
  "PRABHU BANK LIMITED": "PRVU",
  "STANDARD CHARTERED BANK NEPAL": "SCB",
  "STANDARD CHARTERED BANK NEPAL LIMITED": "SCB",
  "NEPAL BANK": "NBL",
  "NEPAL BANK LIMITED": "NBL",
  "AGRICULTURAL DEVELOPMENT BANK": "ADBL",
  "AGRICULTURAL DEVELOPMENT BANK LIMITED": "ADBL",
  "CITIZENS BANK": "CZBIL",
  "CITIZENS BANK INTERNATIONAL": "CZBIL",
  "SHIVAM CEMENTS": "SHIVM",
  "SHIVAM CEMENTS LIMITED": "SHIVM",
  "CITIZENS INVESTMENT TRUST": "CIT",
  "NEPAL TELECOM": "NTC",
  "NEPAL INFRASTRUCTURE BANK": "NIFRA"
};

function resolveWatchlistSymbol(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!raw) return "";
  return COMPANY_SYMBOL_MAP[raw] || raw;
}

function getSectorOverrides() {
  const p = getCurrentPortfolio();
  if (!p.sectorOverrides) p.sectorOverrides = {};
  return p.sectorOverrides;
}

function getSector(symbol) {
  const overrides = getSectorOverrides();
  if (overrides[symbol]) return overrides[symbol];
  return SECTOR_MAP[symbol] || "Unclassified";
}

const SECTOR_COLORS = ["#3FA796", "#5B9BD5", "#C4553D", "#D9A441", "#8B7FD8", "#4EA8DE", "#E07A5F", "#81B29A", "#9B8AA6", "#C77DFF", "#6B7680"];

function renderSectorBreakdown() {
  const barsEl = document.getElementById("sectorBars");
  const unmappedEl = document.getElementById("sectorUnmapped");
  if (!holdings.length) {
    barsEl.innerHTML = '<div class="empty-state">No holdings yet — add or import some to see sector breakdown.</div>';
    unmappedEl.innerHTML = "";
    return;
  }

  const bySector = {};
  let totalValue = 0;
  const unmapped = new Set();

  holdings.forEach((h) => {
    const p = prices[h.symbol];
    const ltp = p ? p.ltp : null;
    const value = ltp ? ltp * h.qty : h.avgCost * h.qty;
    const sector = getSector(h.symbol);
    if (sector === "Unclassified") unmapped.add(h.symbol);
    bySector[sector] = (bySector[sector] || 0) + value;
    totalValue += value;
  });

  const sorted = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
  barsEl.innerHTML = sorted.map(([sector, value], i) => {
    const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
    const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-family:'Inter',sans-serif; font-size:12px; margin-bottom:5px;">
          <span style="color:#EDEFF1;">${sector}</span>
          <span class="muted">Rs ${fmt(value, 0)} · ${fmt(pct, 1)}%</span>
        </div>
        <div style="height:8px; background:#14181C; border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; border-radius:4px;"></div>
        </div>
      </div>
    `;
  }).join("");

  if (unmapped.size === 0) {
    unmappedEl.innerHTML = '<span class="muted label" style="font-size:12px;">All your holdings are classified.</span>';
  } else {
    unmappedEl.innerHTML = [...unmapped].map((sym) => `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span class="sym label" style="width:80px;">${esc(sym)}</span>
        <input type="text" class="sector-override-input" data-symbol="${esc(sym)}" placeholder="e.g. Commercial Banks" style="background:#14181C; border:1px solid #2A3138; border-radius:6px; padding:7px 10px; color:#EDEFF1; font-size:12px; font-family:inherit; width:200px;" />
        <button class="btn label sector-override-save" data-symbol="${esc(sym)}" style="padding:6px 10px; font-size:12px;">Set</button>
      </div>
    `).join("");
    unmappedEl.querySelectorAll(".sector-override-save").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sym = btn.dataset.symbol;
        const input = unmappedEl.querySelector(`.sector-override-input[data-symbol="${sym}"]`);
        const val = input.value.trim();
        if (!val) return;
        const overrides = getSectorOverrides();
        overrides[sym] = val;
        saveState();
        renderSectorBreakdown();
      });
    });
  }
}

