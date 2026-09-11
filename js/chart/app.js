/* =========================================================
   NTC — app.js
   Bootstraps the standalone chart application: wires DOM,
   datafeed, engine, watchlist, symbol search and toolbar together.
   Fully isolated — does not touch any global used by index.html,
   chart_2.html, dashboard.html or portfolio.html.
   ========================================================= */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const els = {
    symTitle: $("#ntcSymTitle"),
    symMeta: $("#ntcSymMeta"),
    ohO: $("#ntcOhO"),
    ohH: $("#ntcOhH"),
    ohL: $("#ntcOhL"),
    ohC: $("#ntcOhC"),
    ohV: $("#ntcOhV"),
    ohChg: $("#ntcOhChg"),
    chartEl: null,
    volEl: null,
    chartGrid: $("#ntcChartGrid"),
    layoutSelect: $("#ntcLayoutSelect"),
    syncMenu: $("#ntcSyncMenu"),
    statusBox: $("#ntcStatus"),
    statusText: $("#ntcStatusText"),
    timeframeRow: $("#ntcTfRow"),
    chartTypeSelect: $("#ntcChartTypeSelect"),
    searchInput: $("#ntcTopSearchInput"),
    searchTrigger: $("#ntcRailSearch"),
    watchlistTrigger: $("#ntcRailWatchlist"),
    rightCol: $("#ntcRightCol"),
    wlTabs: $("#ntcWlTabs"),
    wlAddTab: $("#ntcWlAddTab"),
    wlList: $("#ntcWlList"),
    wlAddSymbolInput: $("#ntcWlAddSymbolInput"),
    wlAddSymbolBtn: $("#ntcWlAddSymbolBtn"),
    wlRenameBtn: $("#ntcWlRenameBtn"),
    wlDeleteBtn: $("#ntcWlDeleteBtn"),
    modalOverlay: $("#ntcSearchModal"),
    modalInput: $("#ntcSearchModalInput"),
    modalList: $("#ntcSearchModalList"),
    modalClose: $("#ntcSearchModalClose"),
    promptOverlay: $("#ntcPrompt"),
    promptInput: $("#ntcPromptInput"),
    promptOk: $("#ntcPromptOk"),
    promptCancel: $("#ntcPromptCancel"),
    promptTitle: $("#ntcPromptTitle"),
    indicatorsBtn: $("#ntcIndicatorsBtn"),
    alertsBtn: $("#ntcAlertsBtn"), replayBtn: $("#ntcReplayBtn"), replayModal: $("#ntcReplayModal"), replayBody: $("#ntcReplayBody"), paperBtn: $("#ntcPaperBtn"), paperModal: $("#ntcPaperModal"), paperClose: $("#ntcPaperClose"), paperSummary: $("#ntcPaperSummary"), paperBody: $("#ntcPaperBody"), alertCount: $("#ntcAlertCount"), alertModal: $("#ntcAlertModal"), alertClose: $("#ntcAlertClose"), alertType: $("#ntcAlertType"), alertValue: $("#ntcAlertValue"), alertDirection: $("#ntcAlertDirection"), alertAdd: $("#ntcAlertAdd"), alertList: $("#ntcAlertList"),
    indicatorModal: $("#ntcIndicatorModal"),
    indicatorSearch: $("#ntcIndicatorSearch"),
    indicatorCats: $("#ntcIndicatorCats"),
    indicatorList: $("#ntcIndicatorList"),
    indicatorClear: $("#ntcIndicatorClear"),
    activeIndicators: $("#ntcActiveIndicators"),
    drawToolbar: $("#ntcDrawToolbar"),
    drawText: $("#ntcDrawText"), drawUndo: $("#ntcDrawUndo"), drawHide: $("#ntcDrawHide"),
    drawLock: $("#ntcDrawLock"), drawClear: $("#ntcDrawClear"),
    fitBtn: $("#ntcFitBtn"), logBtn: $("#ntcLogBtn"), pctBtn: $("#ntcPctBtn"), invertBtn: $("#ntcInvertBtn"),
    feedDot: $("#ntcFeedDot"), feedState: $("#ntcFeedState"), appVersion: $("#ntcAppVersion"),
    workspaceBtn: $("#ntcWorkspaceBtn"), brokerBtn: $("#ntcBrokerBtn"), workspaceModal: $("#ntcWorkspaceModal"), workspaceClose: $("#ntcWorkspaceClose"),
    brokerLabel: $("#ntcBrokerLabel"), brokerBaseUrl: $("#ntcBrokerBaseUrl"), brokerHealthPath: $("#ntcBrokerHealthPath"), brokerAuthMode: $("#ntcBrokerAuthMode"), brokerSecret: $("#ntcBrokerSecret"),
    brokerSave: $("#ntcBrokerSave"), brokerTest: $("#ntcBrokerTest"), brokerDisconnect: $("#ntcBrokerDisconnect"), exportWorkspace: $("#ntcExportWorkspace"), importWorkspace: $("#ntcImportWorkspace"), workspaceFile: $("#ntcWorkspaceFile"), errorToast: $("#ntcErrorToast"),
  };

  const STATE = window.NTC_STATE;
  let engine = null;
  let indicatorCategory = "All";
  let activeIndicators = [];
  let drawings = null;
  let layoutManager = null;
  let charts = [];
  let sync = {symbol:false,timeframe:false,crosshair:false};
  let replay = null;

  function activeItem(){ return layoutManager ? layoutManager.getActive() : charts[0] || null; }
  function saveWorkspace(){
    if(!layoutManager) return;
    window.NTC_STORAGE.saveWorkspace({layout:layoutManager.getLayout(),active:layoutManager.active,sync,charts:charts.map(c=>({symbol:c.symbol||"NABIL",timeframe:c.timeframe||"1D",chartType:c.chartType||"candles",indicators:c.indicators||[]}))});
  }
  function setActiveContext(item){
    if(!item) return;
    engine=item.engine; drawings=item.drawings||null; activeIndicators=item.indicators||[];
    STATE.symbol=item.symbol||"NABIL"; STATE.timeframe=item.timeframe||"1D"; STATE.chartType=item.chartType||"candles"; STATE.candles=item.candles||[];
    window.NTC_TOOLBAR.setActiveTimeframe(STATE.timeframe); window.NTC_TOOLBAR.setChartType(STATE.chartType);
    renderActiveIndicators();
    if(drawings) drawings.setSeries(engine.mainSeries);
    const last=STATE.candles[STATE.candles.length-1], prev=STATE.candles.length>1?STATE.candles[STATE.candles.length-2]:null;
    window.NTC_PANELS.setSymbol(STATE.symbol,null); window.NTC_PANELS.updateFromCandle(last,prev);
  }
  function makeChartItem(index){
    const card=document.createElement("div"); card.className="ntc-chart-card"; card.dataset.index=index;
    const head=document.createElement("div"); head.className="ntc-chart-card-head"; head.innerHTML='<b>—</b><span class="ntc-chart-badge">1D</span><span class="spacer"></span><button title="Activate chart">ACTIVE</button>';
    const area=document.createElement("div"); area.className="ntc-card-chart";
    const main=document.createElement("div"); main.className="ntc-card-main";
    const vol=document.createElement("div"); vol.className="ntc-card-vol";
    area.appendChild(main); area.appendChild(vol); card.appendChild(head); card.appendChild(area); els.chartGrid.appendChild(card);
    const item={id:"chart"+(index+1),card,head,main,vol,engine:null,drawings:null,symbol:"NABIL",timeframe:"1D",chartType:"candles",candles:[],indicators:[]};
    item.engine=new NTCEngine({chartEl:main,volEl:vol,onCrosshair:(price,param)=>{
      // Cross-chart crosshair sync only ever affects OTHER charts, and only
      // when the "Cross" sync toggle is on. It must never gate whether this
      // chart's own OHLC readout updates on hover.
      if(sync.crosshair&&param&&param.time){
        charts.forEach(other=>{if(other!==item&&other.engine){try{other.engine.chart.setCrosshairPosition(0,param.time,other.engine.mainSeries)}catch(e){}}});
      }
      if(item!==activeItem())return;
      if(price&&param&&param.time){
        const hoveredTime=Number(param.time);
        const idx=(item.candles||[]).findIndex(c=>Number(c.time)===hoveredTime);
        const prev=idx>0?item.candles[idx-1]:null;
        window.NTC_PANELS.updateFromCandle(price,prev);
      } else {
        // Crosshair left the chart — fall back to the last real candle
        // instead of leaving a stale hovered value on screen.
        const cs=item.candles||[];
        const last=cs[cs.length-1], prev=cs.length>1?cs[cs.length-2]:null;
        window.NTC_PANELS.updateFromCandle(last,prev);
      }
    }});
    if(window.NTC_DrawingEngine)item.drawings=new window.NTC_DrawingEngine({container:main,chart:item.engine.chart,series:item.engine.mainSeries,symbol:item.symbol,onChange:()=>{}});
    head.querySelector("button").addEventListener("click",()=>layoutManager.setActive(index));
    card.addEventListener("dblclick",()=>layoutManager.setActive(index));
    return item;
  }
  function populateLayoutSelect(){
    const opts=[['1','1 chart'],['2h','2 charts'],['2v','2 stacked'],['4','4 charts'],['6','6 charts'],['8','8 charts'],['12','12 charts'],['16','16 charts']];
    els.layoutSelect.innerHTML=opts.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join("");
  }
  function initLayout(){
    populateLayoutSelect();
    layoutManager=new window.NTC_LayoutManager({root:els.chartGrid,onActiveChange:(item)=>{setActiveContext(item);saveWorkspace();},onCreate:(i)=>{const x=makeChartItem(i);charts.push(x);return x;},onDestroy:(item)=>{if(item.drawings)item.drawings.destroy();if(item.engine)item.engine.destroy&&item.engine.destroy();item.card.remove();const i=charts.indexOf(item);if(i>=0)charts.splice(i,1);}});
    const saved=window.NTC_STORAGE.loadWorkspace()||{}; sync=Object.assign(sync,saved.sync||{});
    ["symbol","timeframe","crosshair"].forEach(k=>{const box=els.syncMenu.querySelector(`[data-sync="${k}"]`);if(box)box.checked=!!sync[k];});
    const count=saved.charts&&Array.isArray(saved.charts)?saved.charts:[]; const initial=Math.max(1,Math.min(16,count.length||1));
    const key=saved.layout||"1"; layoutManager.setLayout(key);
    // Restore per-chart state after creation.
    count.slice(0,charts.length).forEach((c,i)=>Object.assign(charts[i],{symbol:c.symbol||"NABIL",timeframe:c.timeframe||"1D",chartType:c.chartType||"candles",indicators:Array.isArray(c.indicators)?c.indicators:[]}));
    if(!count.length && charts[0]) charts[0].symbol=window.NTC_STORAGE.loadPrefs().symbol||"NABIL";
    layoutManager.setActive(Math.min(Number(saved.active)||0,charts.length-1));
    els.layoutSelect.value=key;
    els.layoutSelect.addEventListener("change",()=>{layoutManager.setLayout(els.layoutSelect.value);saveWorkspace();});
    els.syncMenu.querySelectorAll("input[data-sync]").forEach(box=>box.addEventListener("change",()=>{sync[box.dataset.sync]=box.checked;saveWorkspace();}));
  }

  function setFeedHealth(kind, text){
    if(els.feedDot) els.feedDot.className="ntc-health-dot "+(kind||"");
    if(els.feedState) els.feedState.textContent=text;
  }
  function toastError(message){
    if(!els.errorToast)return; els.errorToast.textContent=String(message||"Unexpected error"); els.errorToast.classList.add("show");
    clearTimeout(toastError._timer); toastError._timer=setTimeout(()=>els.errorToast.classList.remove("show"),6000);
  }
  function downloadJSON(filename,data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function openWorkspaceSettings(){
    const c=window.NTC_BROKER.getConfig();
    els.brokerLabel.value=c.label||""; els.brokerBaseUrl.value=c.baseUrl||""; els.brokerHealthPath.value=c.healthPath||"/"; els.brokerAuthMode.value=c.authMode||"bearer"; els.brokerSecret.value="";
    els.workspaceModal.classList.add("show");
  }
  async function testBroker(){
    try{setFeedHealth("warn","Broker / TMS: testing…");await window.NTC_BROKER.health();setFeedHealth("ok","Broker / TMS: connected");toastError("Broker connection test succeeded.")}
    catch(e){setFeedHealth("err","Broker / TMS: not connected");toastError(e.message||"Broker connection failed.")}
  }
  function initPhase10(){
    if(els.appVersion&&window.NTC_CONFIG) els.appVersion.textContent="NTC "+window.NTC_CONFIG.APP_VERSION;
    setFeedHealth("warn","Market feed: checking…");
    els.workspaceBtn&&els.workspaceBtn.addEventListener("click",openWorkspaceSettings);
    els.brokerBtn&&els.brokerBtn.addEventListener("click",openWorkspaceSettings);
    els.workspaceClose&&els.workspaceClose.addEventListener("click",()=>els.workspaceModal.classList.remove("show"));
    els.workspaceModal&&els.workspaceModal.addEventListener("click",e=>{if(e.target===els.workspaceModal)els.workspaceModal.classList.remove("show")});
    els.brokerSave&&els.brokerSave.addEventListener("click",()=>{window.NTC_BROKER.configure({label:els.brokerLabel.value,baseUrl:els.brokerBaseUrl.value,healthPath:els.brokerHealthPath.value,authMode:els.brokerAuthMode.value});window.NTC_BROKER.setSessionSecret(els.brokerSecret.value);els.brokerSecret.value="";setFeedHealth(window.NTC_BROKER.isConfigured()?"warn":"","Broker / TMS: "+(window.NTC_BROKER.isConfigured()?"configured":"not configured"));toastError("Connector settings saved locally; session secret was not saved.")});
    els.brokerTest&&els.brokerTest.addEventListener("click",testBroker);
    els.brokerDisconnect&&els.brokerDisconnect.addEventListener("click",()=>{window.NTC_BROKER.clearSessionSecret();setFeedHealth("","Broker / TMS: disconnected");toastError("Broker session disconnected.")});
    els.exportWorkspace&&els.exportWorkspace.addEventListener("click",()=>downloadJSON("ntc-workspace-backup.json",window.NTC_STORAGE.exportData()));
    els.importWorkspace&&els.importWorkspace.addEventListener("click",()=>els.workspaceFile&&els.workspaceFile.click());
    els.workspaceFile&&els.workspaceFile.addEventListener("change",()=>{const file=els.workspaceFile.files&&els.workspaceFile.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{window.NTC_STORAGE.importData(JSON.parse(reader.result));toastError("Workspace imported. Reload the chart to apply the imported layout.")}catch(e){toastError(e.message||"Invalid workspace backup.")}finally{els.workspaceFile.value=""}};reader.readAsText(file)});
    window.addEventListener("offline",()=>setFeedHealth("err","Network: offline"));
    window.addEventListener("online",()=>setFeedHealth("warn",window.NTC_BROKER.isConfigured()?"Market feed: online · broker configured":"Market feed: online"));
    window.addEventListener("error",e=>{if(e&&e.message)toastError(e.message)});
    window.addEventListener("unhandledrejection",e=>{const r=e&&e.reason;toastError(r&&r.message?r.message:String(r||"Unhandled error"))});
  }

  function showStatus(html, isErr) {
    els.statusText.className = "ntc-status" + (isErr ? " err" : "");
    els.statusText.innerHTML = html;
    els.statusBox.classList.add("show");
  }
  function hideStatus() {
    els.statusBox.classList.remove("show");
  }

  async function loadSymbol(symbol, { skipHistoryPersist } = {}) {
    symbol = (symbol || "").trim().toUpperCase();
    if (!symbol) return;
    const item=activeItem(); if(!item)return;
    if(replay) replay.close();
    showStatus("Loading " + symbol + "…", false);
    try {
      const candles = await window.NTC_DATAFEED.fetchCandles(symbol);
      setFeedHealth("ok", "Market feed: live data loaded");
      item.symbol=symbol; item.candles=candles; STATE.symbol=symbol; STATE.candles=candles;
      if(sync.symbol) charts.forEach(other=>{ if(other!==item) { other.symbol=symbol; other.candles=candles.slice(); other.engine.render(other.candles); if(other.drawings){other.drawings.setSymbol(symbol);other.drawings.setSeries(other.engine.mainSeries)} other.engine.renderIndicators(other.indicators||[],other.candles); const b=other.head&&other.head.querySelector("b");if(b)b.textContent=symbol; }});
      item.engine.render(candles);
      processPaperForItem(item);
      if(item.drawings){ item.drawings.setSymbol(symbol); item.drawings.setSeries(item.engine.mainSeries); }
      item.engine.renderIndicators(item.indicators, candles);
      engine=item.engine; drawings=item.drawings; activeIndicators=item.indicators;
      const cardTitle=item.head&&item.head.querySelector("b"), cardTf=item.head&&item.head.querySelector(".ntc-chart-badge"); if(cardTitle)cardTitle.textContent=symbol;if(cardTf)cardTf.textContent=item.timeframe;
      renderActiveIndicators();

      const quote = await window.NTC_DATAFEED.lookupQuote(symbol).catch(() => null);
      window.NTC_PANELS.setSymbol(symbol, quote);
      const last = candles[candles.length - 1];
      const prev = candles.length > 1 ? candles[candles.length - 2] : null;
      window.NTC_PANELS.updateFromCandle(last, prev);

      window.NTC_STORAGE.savePrefs({ symbol, timeframe: item.timeframe, chartType: item.chartType });
      saveWorkspace();
      renderWatchlistPanel();
      await checkAlerts(item);
      hideStatus();
    } catch (err) {
      setFeedHealth("err", "Market feed: unavailable");
      showStatus("Couldn't load " + symbol + ": " + escapeHtml(err.message), true);
      toastError(err.message);
    }
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---------- Watchlist panel ----------
  function renderWatchlistTabs() {
    els.wlTabs.innerHTML = "";
    window.NTC_WATCHLIST.getAll().forEach((list) => {
      const btn = document.createElement("button");
      btn.className = "ntc-wl-tab" + (list.id === STATE.activeWatchlistId ? " active" : "");
      btn.textContent = list.name;
      btn.title = list.name;
      btn.addEventListener("click", () => {
        window.NTC_WATCHLIST.setActive(list.id);
        renderWatchlistTabs();
        renderWatchlistPanel();
      });
      els.wlTabs.appendChild(btn);
    });
  }

  async function renderWatchlistPanel() {
    const list = window.NTC_WATCHLIST.getActive();
    if (!list.symbols.length) {
      els.wlList.innerHTML = '<div class="ntc-wl-empty">No symbols yet. Use the box above to add one.</div>';
      return;
    }
    const board = await window.NTC_DATAFEED.fetchBoard(false).catch(() => []);
    const bySym = {};
    board.forEach((r) => (bySym[r.symbol] = r));

    els.wlList.innerHTML = "";
    list.symbols.forEach((sym, idx) => {
      const row = document.createElement("div");
      row.className = "ntc-wl-row" + (sym === STATE.symbol ? " active" : "");
      row.draggable = true;
      row.dataset.index = idx;

      const q = bySym[sym];
      const chg = q ? Number(q.percentChange) : null;
      const dirClass = chg === null || isNaN(chg) ? "" : chg >= 0 ? "up" : "down";
      const chgStr = chg === null || isNaN(chg) ? "—" : (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%";

      row.innerHTML = `
        <span class="ntc-wl-sym">${escapeHtml(sym)}</span>
        <span class="ntc-wl-last">${q ? fmtNum(q.ltp) : "—"}</span>
        <span class="ntc-wl-chg ${dirClass}">${chgStr}</span>
        <button class="ntc-wl-remove" title="Remove" data-remove="${escapeHtml(sym)}">✕</button>
      `;
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-remove]")) return;
        loadSymbol(sym);
      });
      row.querySelector("[data-remove]").addEventListener("click", (e) => {
        e.stopPropagation();
        window.NTC_WATCHLIST.removeSymbol(sym);
        renderWatchlistPanel();
      });

      row.addEventListener("dragstart", () => row.classList.add("dragging"));
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const dragging = els.wlList.querySelector(".dragging");
        if (!dragging || dragging === row) return;
        const from = Number(dragging.dataset.index);
        const to = Number(row.dataset.index);
        window.NTC_WATCHLIST.reorder(from, to);
        renderWatchlistPanel();
      });

      els.wlList.appendChild(row);
    });
  }

  // ---------- Symbol search modal ----------
  function openSearchModal() {
    els.modalOverlay.classList.add("show");
    els.modalInput.value = "";
    els.modalInput.focus();
    renderSearchResults("");
  }
  function closeSearchModal() {
    els.modalOverlay.classList.remove("show");
  }
  async function renderSearchResults(query) {
    await window.NTC_SYMBOLSEARCH.ensureLoaded();
    const results = window.NTC_SYMBOLSEARCH.search(query);
    if (!results.length) {
      els.modalList.innerHTML = '<div class="ntc-modal-empty">No matching symbols.</div>';
      return;
    }
    els.modalList.innerHTML = "";
    results.forEach((r) => {
      const row = document.createElement("div");
      row.className = "ntc-modal-row";
      const chg = Number(r.percentChange);
      const dirClass = isNaN(chg) ? "" : chg >= 0 ? "up" : "down";
      row.innerHTML = `<span><span class="sym">${escapeHtml(r.symbol)}</span><span class="name">${escapeHtml(r.name || r.sector || "")}</span></span><span class="${dirClass} ntc-mono">${fmtNum(r.ltp)}</span>`;
      row.addEventListener("click", () => {
        closeSearchModal();
        loadSymbol(r.symbol);
      });
      els.modalList.appendChild(row);
    });
  }

  // ---------- Rename/delete list prompt ----------
  function promptText(title, defaultValue) {
    return new Promise((resolve) => {
      els.promptTitle.textContent = title;
      els.promptInput.value = defaultValue || "";
      els.promptOverlay.classList.add("show");
      els.promptInput.focus();
      const cleanup = () => {
        els.promptOverlay.classList.remove("show");
        els.promptOk.onclick = null;
        els.promptCancel.onclick = null;
      };
      els.promptOk.onclick = () => {
        const v = els.promptInput.value;
        cleanup();
        resolve(v);
      };
      els.promptCancel.onclick = () => {
        cleanup();
        resolve(null);
      };
    });
  }


  // ---------- Phase 2 Indicator Manager ----------
  function indicatorDefaults(def) {
    const s = {};
    if (def && def.period) s.period = def.period;
    if (def.id === "bb" || def.id === "keltner" || def.id === "atrbands") s.mult = 2;
    if (def.id === "supertrend") { s.atr = 10; s.mult = 3; }
    if (def.id === "psar") { s.step = .02; s.max = .2; }
    if (def.id === "macd") { s.fast = 12; s.slow = 26; s.signal = 9; }
    if (def.id === "stochastic") s.smooth = 3;
    if (def.id === "ichimoku") { s.tenkan=9; s.kijun=26; s.senkou=52; }
    if (def.id === "zigzag") s.depth=5;
    return s;
  }
  function persistIndicators(){ if(activeItem()) activeItem().indicators=activeIndicators; window.NTC_STORAGE.saveIndicators(activeIndicators); saveWorkspace(); }
  function renderActiveIndicators(){
    if(!els.activeIndicators)return;
    els.activeIndicators.innerHTML="";
    activeIndicators.forEach((item,idx)=>{
      const d=window.NTC_INDICATORS.registry[item.id]; if(!d)return;
      const chip=document.createElement("span"); chip.className="ntc-ind-chip";
      chip.innerHTML=`${escapeHtml(d.name)} <button title="Settings">⚙</button><button title="Remove">×</button>`;
      chip.children[0].addEventListener("click",()=>editIndicator(idx));
      chip.children[1].addEventListener("click",()=>removeIndicator(idx));
      els.activeIndicators.appendChild(chip);
    });
  }
  function rerenderIndicators(){ persistIndicators(); renderActiveIndicators(); if(engine)engine.renderIndicators(activeIndicators,STATE.candles); }
  async function editIndicator(idx){
    const item=activeIndicators[idx], d=window.NTC_INDICATORS.registry[item.id];
    if(!d)return;
    const current=item.settings||indicatorDefaults(d);
    const next=Object.assign({},current);
    if(current.period!=null){const v=await promptText(`${d.name}: period`,String(current.period));if(v===null)return;const n=Number(v);if(!Number.isFinite(n)||n<1)return alert("Period must be a positive number.");next.period=Math.round(n)}
    if(["bb","keltner","atrbands"].includes(item.id)){const v=await promptText(`${d.name}: multiplier`,String(current.mult||2));if(v===null)return;const n=Number(v);if(!Number.isFinite(n)||n<=0)return alert("Multiplier must be positive.");next.mult=n}
    if(item.id==="supertrend"){const v=await promptText("Supertrend: ATR multiplier",String(current.mult||3));if(v===null)return;next.mult=Number(v)||3}
    if(item.id==="macd"){const f=await promptText("MACD: fast period",String(current.fast||12));if(f===null)return;const sl=await promptText("MACD: slow period",String(current.slow||26));if(sl===null)return;const sg=await promptText("MACD: signal period",String(current.signal||9));if(sg===null)return;next.fast=Number(f)||12;next.slow=Number(sl)||26;next.signal=Number(sg)||9}
    activeIndicators[idx].settings=next; rerenderIndicators();
  }
  function removeIndicator(idx){activeIndicators.splice(idx,1);rerenderIndicators()}
  function addIndicator(id){
    const d=window.NTC_INDICATORS.registry[id]; if(!d)return;
    activeIndicators.push({id,settings:indicatorDefaults(d)});
    rerenderIndicators();
  }
  function renderIndicatorList(){
    const q=(els.indicatorSearch.value||"").trim().toLowerCase();
    els.indicatorList.innerHTML="";
    window.NTC_INDICATORS.defs.filter(d=>{const osc=["rsi","stochastic","stochrsi","macd","ppo","roc","momentum","cci","williams","ultimate","awesome","trix","tsi","cmo","dpo","fisher","atr","truerange","bbwidth","hv","stddev","cmf","mfi","force","eom","vpt","volosc","relvol"];const catOk=indicatorCategory==="All"||d[2]===indicatorCategory||(indicatorCategory==="Oscillators"&&osc.includes(d[0]));return catOk&&(!q||d[1].toLowerCase().includes(q)||d[0].toLowerCase().includes(q))}).forEach(d=>{
      const row=document.createElement("div");row.className="ntc-ind-row";
      row.innerHTML=`<div><div>${escapeHtml(d[1])}</div><div class="meta">${escapeHtml(d[2])} · ${d[3]?"Overlay":"Pane"}</div></div><button>Add</button>`;
      row.querySelector("button").addEventListener("click",()=>addIndicator(d[0]));
      els.indicatorList.appendChild(row);
    });
  }
  function openIndicatorManager(){els.indicatorModal.classList.add("show");renderIndicatorList();els.indicatorSearch.focus()}
  function closeIndicatorManager(){els.indicatorModal.classList.remove("show")}
  function initIndicators(){
    const closeBtn=document.getElementById("ntcIndicatorClose");
    if(closeBtn) closeBtn.addEventListener("click",closeIndicatorManager);
    if(!Array.isArray(activeIndicators)||!activeIndicators.length){
      const legacy=window.NTC_STORAGE.loadIndicators();
      activeIndicators=Array.isArray(legacy)?legacy:[];
      if(activeItem()) activeItem().indicators=activeIndicators;
    }
    els.indicatorCats.innerHTML="";
    ["All","Trend","Momentum","Oscillators","Volatility","Volume","Market Structure"].forEach(cat=>{
      const b=document.createElement("button");b.className="ntc-indicator-cat"+(cat===indicatorCategory?" active":"");b.textContent=cat;
      b.addEventListener("click",()=>{indicatorCategory=cat;els.indicatorCats.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderIndicatorList()});
      els.indicatorCats.appendChild(b);
    });
    renderActiveIndicators();
    els.indicatorsBtn.addEventListener("click",openIndicatorManager);
    els.indicatorSearch.addEventListener("input",renderIndicatorList);
    els.indicatorClear.addEventListener("click",()=>{if(confirm("Remove all indicators?")){activeIndicators=[];rerenderIndicators()}});
    els.indicatorModal.addEventListener("click",e=>{if(e.target===els.indicatorModal)closeIndicatorManager()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeIndicatorManager()});
  }

  // ---------- Phase 7 Alerts ----------
  function renderAlerts(){
    if(!window.NTC_ALERTS)return; const list=window.NTC_ALERTS.list; els.alertCount.textContent=list.filter(a=>a.enabled).length; els.alertList.innerHTML="";
    if(!list.length){els.alertList.innerHTML='<div class="ntc-wl-empty">No alerts yet.</div>';return;}
    list.forEach(a=>{const row=document.createElement("div");row.className="ntc-alert-row";const desc=a.type==="price"?`${a.symbol} crosses ${a.direction} ${a.value}`:`${a.symbol} ${a.indicatorId} / ${a.compareId} ${a.direction} crossover`;row.innerHTML=`<div><b>${escapeHtml(desc)}</b><div class="meta">${a.enabled?"Enabled":"Disabled"}</div></div><button data-toggle>${a.enabled?"Pause":"Resume"}</button><button data-delete>Delete</button><span></span>`;row.querySelector("[data-toggle]").onclick=()=>{window.NTC_ALERTS.toggle(a.id);renderAlerts()};row.querySelector("[data-delete]").onclick=()=>{window.NTC_ALERTS.remove(a.id);renderAlerts()};els.alertList.appendChild(row)});
  }
  function openAlerts(){els.alertModal.classList.add("show");renderAlerts()}
  function initAlerts(){
    els.alertsBtn.addEventListener("click",openAlerts); els.alertClose.addEventListener("click",()=>els.alertModal.classList.remove("show")); els.alertModal.addEventListener("click",e=>{if(e.target===els.alertModal)els.alertModal.classList.remove("show")});
    els.alertType.addEventListener("change",()=>{els.alertValue.placeholder=els.alertType.value==="price"?"Price level":"indicatorId:compareId (e.g. ema:sma)"});
    els.alertAdd.addEventListener("click",()=>{const symbol=STATE.symbol||"NABIL",type=els.alertType.value,dir=els.alertDirection.value,v=els.alertValue.value.trim();if(type==="price"){const n=Number(v);if(!Number.isFinite(n))return alert("Enter a valid price level.");window.NTC_ALERTS.add({symbol,type,value:n,direction:dir});}else{const parts=v.toLowerCase().split(":");if(parts.length!==2||!window.NTC_INDICATORS.registry[parts[0]]||!window.NTC_INDICATORS.registry[parts[1]])return alert("Use two valid indicator IDs, e.g. ema:sma.");window.NTC_ALERTS.add({symbol,type,indicatorId:parts[0],compareId:parts[1],lineKey:"EMA",compareKey:"SMA",direction:dir,settings:{}})}els.alertValue.value="";renderAlerts()});
    document.addEventListener("ntc-alert-trigger",e=>{const toast=document.createElement("div");toast.className="ntc-alert-toast";toast.textContent=e.detail.message;document.body.appendChild(toast);setTimeout(()=>toast.remove(),5000);renderAlerts()});
    renderAlerts();
  }
  async function checkAlerts(item){if(window.NTC_ALERTS&&item)await window.NTC_ALERTS.check(item.symbol,item.candles)}



  // ---------- Phase 8 Paper Trading ----------
  let paperTab = "order";
  function paperPrices(){const out={};charts.forEach(c=>{const x=c.candles&&c.candles[c.candles.length-1];if(x)out[c.symbol]=Number(x.close)});return out}
  function paperMoney(n){return Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
  function paperToast(msg,err){const t=document.createElement("div");t.className="ntc-paper-toast "+(err?"err":"ok");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
  function paperSummary(){const a=window.NTC_PAPER.getAccount(paperPrices());els.paperSummary.innerHTML=[['Cash',a.cash],['Equity',a.equity],['Buying power',a.buyingPower],['Unrealized P&L',a.unrealizedPnl],['Realized P&L',a.realizedPnl]].map(x=>`<div class="ntc-paper-stat"><small>${x[0]}</small><b class="${x[1]<0?'down':x[1]>0?'up':''}">${paperMoney(x[1])}</b></div>`).join("")}
  function paperTable(headers,rows,empty="Nothing here yet."){if(!rows.length)return `<div class="ntc-paper-empty">${empty}</div>`;return `<table class="ntc-paper-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`}
  function renderPaper(){
    if(!els.paperBody)return; paperSummary();
    els.paperBody.querySelectorAll(".paper-action").forEach(x=>x.remove());
    if(paperTab==="order"){
      const sym=STATE.symbol||"NABIL", p=window.NTC_PAPER.positions(paperPrices()).find(x=>x.symbol===sym), last=activeItem()&&activeItem().candles.length?activeItem().candles[activeItem().candles.length-1].close:"";
      const note=p?`<div class="ntc-paper-note">Position: ${p.qty} shares @ ${paperMoney(p.avgPrice)} · SL ${p.stopLoss||"—"} · TP ${p.takeProfit||"—"}</div>`:`<div class="ntc-paper-note">Paper trading is simulated locally. No orders are sent to TMS or a broker.</div>`;
      els.paperBody.innerHTML=`<div class="ntc-paper-form"><select id="ntcPaperSide"><option value="buy">Buy</option><option value="sell">Sell</option></select><select id="ntcPaperType"><option value="market">Market</option><option value="limit">Limit</option><option value="stop">Stop</option><option value="stop_limit">Stop Limit</option></select><input id="ntcPaperQty" type="number" min="1" step="1" value="10" placeholder="Quantity"><input id="ntcPaperLimit" type="number" min="0" step="0.01" placeholder="Limit price"><input id="ntcPaperStop" type="number" min="0" step="0.01" placeholder="Stop price"><input id="ntcPaperSL" type="number" min="0" step="0.01" placeholder="Stop loss"><input id="ntcPaperTP" type="number" min="0" step="0.01" placeholder="Take profit"><button class="ntc-btn primary" id="ntcPaperPlace">Place</button></div><div class="ntc-paper-settings">Starting <input id="ntcPaperStarting" type="number" min="1" step="1000" value="${window.NTC_PAPER.getState().startingCash}"> · Symbol <b>${escapeHtml(sym)}</b> · Last <b>${paperMoney(last)}</b> · Fees <input id="ntcPaperFees" type="number" min="0" step="0.1" value="${window.NTC_PAPER.getState().feesBps}"> bps · Slippage <input id="ntcPaperSlip" type="number" min="0" step="0.1" value="${window.NTC_PAPER.getState().slippageBps}"> bps <button class="ntc-btn" id="ntcPaperSaveSettings">Save</button><button class="ntc-btn" id="ntcPaperReset">Reset account</button></div>${note}`;
      const type=document.getElementById("ntcPaperType"); const lim=document.getElementById("ntcPaperLimit"),stop=document.getElementById("ntcPaperStop"); const syncFields=()=>{const t=type.value;lim.disabled=!(t==="limit"||t==="stop_limit");stop.disabled=!(t==="stop"||t==="stop_limit")};type.onchange=syncFields;syncFields();
      document.getElementById("ntcPaperPlace").onclick=()=>{try{const o=window.NTC_PAPER.place({symbol:sym,side:document.getElementById("ntcPaperSide").value,type:type.value,qty:document.getElementById("ntcPaperQty").value,limitPrice:lim.value,stopPrice:stop.value,stopLoss:document.getElementById("ntcPaperSL").value,takeProfit:document.getElementById("ntcPaperTP").value});if(o.type==="market"){const c=activeItem().candles.at(-1);window.NTC_PAPER.processQuote(sym,{close:c.close})}renderPaper();paperToast(o.status==="filled"?`Filled ${o.side} ${o.qty} ${sym}`:`Order ${o.status}: ${sym}`)}catch(e){paperToast(e.message,true)}};
      document.getElementById("ntcPaperSaveSettings").onclick=()=>{window.NTC_PAPER.configure({startingCash:document.getElementById("ntcPaperStarting").value,feesBps:document.getElementById("ntcPaperFees").value,slippageBps:document.getElementById("ntcPaperSlip").value});renderPaper();paperToast("Paper settings saved")}; document.getElementById("ntcPaperReset").onclick=()=>{if(confirm("Reset paper account and delete all simulated orders/trades?")){window.NTC_PAPER.reset();renderPaper();paperToast("Paper account reset")}};
    } else if(paperTab==="positions"){
      const rows=window.NTC_PAPER.positions(paperPrices()).map(p=>`<tr><td>${escapeHtml(p.symbol)}</td><td class="num">${p.qty}</td><td class="num">${paperMoney(p.avgPrice)}</td><td class="num">${paperMoney(p.lastPrice)}</td><td class="num ${p.unrealizedPnl<0?'down':'up'}">${paperMoney(p.unrealizedPnl)}</td><td class="num">${p.pnlPct.toFixed(2)}%</td><td><button class="ntc-btn" data-close="${escapeHtml(p.symbol)}">Close</button></td></tr>`);els.paperBody.innerHTML=paperTable(['Symbol','Qty','Avg','Last','Unrealized','P&L%',''],rows,'No open positions.');els.paperBody.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{try{const sym=b.dataset.close,c=charts.find(x=>x.symbol===sym)?.candles.at(-1);window.NTC_PAPER.closePosition(sym,c.close);renderPaper();paperToast(`Closed ${sym}`)}catch(e){paperToast(e.message,true)}})
    } else if(paperTab==="orders"){
      const rows=window.NTC_PAPER.orders().map(o=>`<tr><td>${escapeHtml(o.symbol)}</td><td>${o.side.toUpperCase()}</td><td>${o.type}</td><td class="num">${o.qty}</td><td>${o.status}</td><td class="num">${o.fillPrice?paperMoney(o.fillPrice):o.limitPrice?paperMoney(o.limitPrice):"—"}</td><td>${o.status==="open"?`<button class="ntc-btn" data-cancel="${o.id}">Cancel</button>`:""}</td></tr>`);els.paperBody.innerHTML=paperTable(['Symbol','Side','Type','Qty','Status','Price',''],rows,'No orders.');els.paperBody.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{window.NTC_PAPER.cancel(b.dataset.cancel);renderPaper()})
    } else if(paperTab==="trades"){
      const rows=window.NTC_PAPER.trades().map(t=>`<tr><td>${escapeHtml(t.symbol)}</td><td>${t.side.toUpperCase()}</td><td class="num">${t.qty}</td><td class="num">${paperMoney(t.price)}</td><td class="num">${paperMoney(t.fees)}</td><td>${new Date(t.time).toLocaleString()}</td></tr>`);els.paperBody.innerHTML=paperTable(['Symbol','Side','Qty','Price','Fees','Time'],rows,'No fills yet.')
    } else {
      const rows=window.NTC_PAPER.history().slice(0,100).map(h=>`<tr><td>${new Date(h.time).toLocaleString()}</td><td>${escapeHtml(h.type)}</td><td>${escapeHtml(h.symbol||"")}</td><td>${escapeHtml(h.side||"")}</td><td class="num">${h.amount!=null?paperMoney(h.amount):h.price!=null?paperMoney(h.price):""}</td><td class="num">${h.cash!=null?paperMoney(h.cash):""}</td></tr>`);els.paperBody.innerHTML=paperTable(['Time','Event','Symbol','Side','Value','Cash'],rows,'No account activity yet.')
    }
  }
  function openPaper(){els.paperModal.classList.add("show");renderPaper()}
  function initReplay(){
    if(!els.replayBtn||!window.NTC_Replay)return;
    replay=new window.NTC_Replay({button:els.replayBtn,modal:els.replayModal,body:els.replayBody,getActive:()=>activeItem()});
  }

  function initPaper(){
    if(!els.paperBtn)return;els.paperBtn.addEventListener("click",openPaper);els.paperClose.addEventListener("click",()=>els.paperModal.classList.remove("show"));els.paperModal.addEventListener("click",e=>{if(e.target===els.paperModal)els.paperModal.classList.remove("show")});
    els.paperModal.querySelectorAll("[data-paper-tab]").forEach(b=>b.addEventListener("click",()=>{paperTab=b.dataset.paperTab;els.paperModal.querySelectorAll("[data-paper-tab]").forEach(x=>x.classList.toggle("active",x===b));renderPaper()}));
  }
  function processPaperForItem(item){if(!window.NTC_PAPER||!item||!item.candles.length)return;const c=item.candles[item.candles.length-1];window.NTC_PAPER.processQuote(item.symbol,{close:c.close});if(els.paperModal.classList.contains("show"))renderPaper()}

  // ---------- Wire everything ----------
  function initDrawings(){
    els.drawToolbar.querySelectorAll("[data-draw]").forEach(btn=>btn.addEventListener("click",()=>{els.drawToolbar.querySelectorAll("[data-draw]").forEach(x=>x.classList.remove("tool-active"));btn.classList.add("tool-active");if(drawings)drawings.setTool(btn.dataset.draw)}));
    els.drawText.addEventListener("click",()=>{els.drawToolbar.querySelectorAll("[data-draw]").forEach(x=>x.classList.remove("tool-active"));if(drawings)drawings.setTool("text")});
    els.drawUndo.addEventListener("click",()=>drawings&&drawings.deleteLast());
    els.drawHide.addEventListener("click",()=>{if(drawings){const hidden=drawings.hide();els.drawHide.textContent=hidden?"Show":"Hide"}});
    els.drawLock.addEventListener("click",()=>{if(drawings){const locked=drawings.lock();els.drawLock.textContent=locked?"Unlock":"Lock"}});
    els.drawClear.addEventListener("click",()=>{if(drawings&&confirm("Clear all drawings for this symbol?"))drawings.clear()});
    document.addEventListener("keydown",(e)=>{
      if(!drawings||!drawings.selected)return;
      if(e.key==="Delete"||e.key==="Backspace"){
        const tag=(document.activeElement&&document.activeElement.tagName||"").toLowerCase();
        if(["input","textarea","select"].includes(tag))return;
        e.preventDefault();drawings.deleteSelected();
      } else if(e.key==="Escape"){drawings.selected=null;drawings.render();}
    });
    els.fitBtn.addEventListener("click",()=>engine&&engine.autoscale());
    els.logBtn.addEventListener("click",()=>engine&&engine.setScaleMode("log"));
    els.pctBtn.addEventListener("click",()=>engine&&engine.setScaleMode("percent"));
    els.invertBtn.addEventListener("click",()=>engine&&engine.setScaleMode("invert"));
  }

  function wireEvents() {
    els.searchTrigger.addEventListener("click", openSearchModal);
    els.searchInput.addEventListener("focus", openSearchModal);
    els.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadSymbol(els.searchInput.value);
    });
    els.modalClose.addEventListener("click", closeSearchModal);
    els.modalOverlay.addEventListener("click", (e) => {
      if (e.target === els.modalOverlay) closeSearchModal();
    });
    els.modalInput.addEventListener("input", () => renderSearchResults(els.modalInput.value));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSearchModal();
        els.rightCol.classList.remove("open");
        // Escape should close whichever modal is open, not just search —
        // alerts/paper/replay/workspace previously only closed via backdrop click.
        [els.paperModal, els.alertModal, els.replayModal, els.workspaceModal].forEach((m) => {
          if (m && m.classList.contains("show")) m.classList.remove("show");
        });
      }
      if ((e.key === "/" || (e.ctrlKey && e.key.toLowerCase() === "k")) && document.activeElement !== els.modalInput) {
        e.preventDefault();
        openSearchModal();
      }
    });

    els.watchlistTrigger.addEventListener("click", () => els.rightCol.classList.toggle("open"));

    els.wlAddTab.addEventListener("click", async () => {
      const name = await promptText("New watchlist name", "");
      if (name === null) return;
      window.NTC_WATCHLIST.createList(name);
      renderWatchlistTabs();
      renderWatchlistPanel();
    });
    els.wlRenameBtn.addEventListener("click", async () => {
      const list = window.NTC_WATCHLIST.getActive();
      const name = await promptText("Rename watchlist", list.name);
      if (name === null) return;
      window.NTC_WATCHLIST.renameList(list.id, name);
      renderWatchlistTabs();
    });
    els.wlDeleteBtn.addEventListener("click", () => {
      const list = window.NTC_WATCHLIST.getActive();
      if (window.NTC_WATCHLIST.getAll().length <= 1) {
        alert("At least one watchlist must remain.");
        return;
      }
      if (!confirm(`Delete watchlist "${list.name}"?`)) return;
      window.NTC_WATCHLIST.deleteList(list.id);
      renderWatchlistTabs();
      renderWatchlistPanel();
    });
    els.wlAddSymbolBtn.addEventListener("click", () => {
      const v = els.wlAddSymbolInput.value;
      if (window.NTC_WATCHLIST.addSymbol(v)) {
        els.wlAddSymbolInput.value = "";
        renderWatchlistPanel();
      }
    });
    els.wlAddSymbolInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.wlAddSymbolBtn.click();
    });
  }

  async function boot() {
    window.NTC_WATCHLIST.init();
    window.NTC_PANELS.init(els);
    initIndicators();
    initAlerts();
    initPaper();
    initReplay();
    initPhase10();

    initLayout();
    window.NTC_TOOLBAR.init({
      timeframeEl: els.timeframeRow,
      chartTypeEl: els.chartTypeSelect,
      onTimeframe: (id) => {
        if(replay) replay.close();
        const item=activeItem(); if(!item)return; item.timeframe=id; STATE.timeframe=id;
        if(sync.timeframe)charts.forEach(x=>x.timeframe=id);
        window.NTC_TOOLBAR.setActiveTimeframe(id); window.NTC_STORAGE.savePrefs({ symbol: item.symbol, timeframe:id, chartType:item.chartType }); saveWorkspace();
      },
      onChartType: (id) => {
        if(replay) replay.close();
        const item=activeItem(); if(!item)return; item.chartType=id; STATE.chartType=id;
        if(sync.symbol||sync.timeframe){}
        item.engine.setChartType(id); if(item.drawings)item.drawings.setSeries(item.engine.mainSeries);
        window.NTC_STORAGE.savePrefs({ symbol:item.symbol, timeframe:item.timeframe, chartType:id }); saveWorkspace();
      },
    });
    window.NTC_TOOLBAR.setActiveTimeframe("1D");
    setActiveContext(activeItem());

    wireEvents();
    initDrawings();
    renderWatchlistTabs();

    const prefs = window.NTC_STORAGE.loadPrefs();
    if(charts[0] && charts[0].symbol==="NABIL" && prefs.symbol) charts[0].symbol=prefs.symbol;
    // Restore each visible chart independently.
    for(const item of charts){
      const savedSymbol=item.symbol||"NABIL";
      if(item.chartType!=="candles") item.engine.setChartType(item.chartType);
      const old=layoutManager.active; layoutManager.active=charts.indexOf(item); setActiveContext(item); await loadSymbol(savedSymbol);
      item.indicators=item.indicators||[]; item.engine.renderIndicators(item.indicators,item.candles);
    }
    layoutManager.active=Math.min(Number((window.NTC_STORAGE.loadWorkspace()||{}).active)||0,charts.length-1); setActiveContext(activeItem());
    // background-load the board for search + watchlist quotes
    window.NTC_SYMBOLSEARCH.ensureLoaded();
    renderWatchlistPanel();
    setInterval(async()=>{for(const item of charts){if(item.symbol&&item.candles.length){try{item.candles=await window.NTC_DATAFEED.fetchCandles(item.symbol);item.engine.render(item.candles);item.engine.renderIndicators(item.indicators||[],item.candles);processPaperForItem(item);await checkAlerts(item)}catch(e){}}}},30000);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
