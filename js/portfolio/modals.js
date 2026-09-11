/* ---------- Generic app modal ---------- */
function closeAppModal() {
  document.getElementById("appModalOverlay").classList.remove("show");
}

function appConfirm({ title, message, confirmText = "Confirm", danger = false, onConfirm }) {
  const overlay = document.getElementById("appModalOverlay");
  const icon = document.getElementById("appModalIcon");
  const input = document.getElementById("appModalInput");
  const actions = document.getElementById("appModalActions");
  const okBtn = document.getElementById("appModalOk");
  const cancelBtn = document.getElementById("appModalCancel");

  document.getElementById("appModalTitle").textContent = title;
  document.getElementById("appModalMsg").textContent = message;
  icon.className = "app-modal-icon " + (danger ? "warn" : "ask");
  icon.textContent = danger ? "⚠" : "?";
  input.style.display = "none";
  actions.className = "app-modal-actions";
  okBtn.className = "app-modal-ok" + (danger ? " danger" : "");
  okBtn.textContent = confirmText;
  cancelBtn.style.display = "block";

  const cleanup = () => { okBtn.onclick = null; cancelBtn.onclick = null; closeAppModal(); };
  okBtn.onclick = () => { cleanup(); onConfirm && onConfirm(); };
  cancelBtn.onclick = cleanup;
  overlay.classList.add("show");
}

function appAlert({ title = "Notice", message, danger = true }) {
  const overlay = document.getElementById("appModalOverlay");
  const icon = document.getElementById("appModalIcon");
  const input = document.getElementById("appModalInput");
  const actions = document.getElementById("appModalActions");
  const okBtn = document.getElementById("appModalOk");
  const cancelBtn = document.getElementById("appModalCancel");

  document.getElementById("appModalTitle").textContent = title;
  document.getElementById("appModalMsg").textContent = message;
  icon.className = "app-modal-icon " + (danger ? "warn" : "info");
  icon.textContent = danger ? "⚠" : "i";
  input.style.display = "none";
  actions.className = "app-modal-actions single";
  okBtn.className = "app-modal-ok";
  okBtn.textContent = "Got it";
  cancelBtn.style.display = "none";

  const cleanup = () => { okBtn.onclick = null; closeAppModal(); };
  okBtn.onclick = cleanup;
  overlay.classList.add("show");
}

function appPrompt({ title, message, defaultValue = "", placeholder = "", confirmText = "Save", onSubmit }) {
  const overlay = document.getElementById("appModalOverlay");
  const icon = document.getElementById("appModalIcon");
  const input = document.getElementById("appModalInput");
  const actions = document.getElementById("appModalActions");
  const okBtn = document.getElementById("appModalOk");
  const cancelBtn = document.getElementById("appModalCancel");

  document.getElementById("appModalTitle").textContent = title;
  document.getElementById("appModalMsg").textContent = message || "";
  document.getElementById("appModalMsg").style.display = message ? "block" : "none";
  icon.className = "app-modal-icon ask";
  icon.textContent = "?";
  input.style.display = "block";
  input.value = defaultValue;
  input.placeholder = placeholder;
  actions.className = "app-modal-actions";
  okBtn.className = "app-modal-ok";
  okBtn.textContent = confirmText;
  cancelBtn.style.display = "block";

  const submit = () => {
    const val = input.value.trim();
    cleanup();
    if (val) onSubmit && onSubmit(val);
  };
  const cleanup = () => {
    okBtn.onclick = null; cancelBtn.onclick = null; input.onkeydown = null;
    document.getElementById("appModalMsg").style.display = "block";
    closeAppModal();
  };
  okBtn.onclick = submit;
  cancelBtn.onclick = cleanup;
  input.onkeydown = (e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cleanup(); };

  overlay.classList.add("show");
  setTimeout(() => { input.focus(); input.select(); }, 30);
}

document.getElementById("appModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "appModalOverlay") closeAppModal();
});

let tradeModalState = { mode: null, holdingId: null };

function openTradeModal(mode, id) {
  const h = holdings.find((x) => x.id == id);
  if (!h) return;
  tradeModalState = { mode, holdingId: id };

  const overlay = document.getElementById("tradeModalOverlay");
  const titleEl = document.getElementById("tradeModalTitle");
  const titleText = document.getElementById("tradeModalTitleText");
  const sub = document.getElementById("tradeModalSub");
  const qtyInput = document.getElementById("tradeQty");
  const priceInput = document.getElementById("tradePrice");
  const feesField = document.getElementById("tradeFeesField");
  const feesInput = document.getElementById("tradeFees");
  const dateField = document.getElementById("tradeDateField");
  const dateInput = document.getElementById("tradeDate");
  const qtyHint = document.getElementById("tradeQtyHint");
  const totalLabel = document.getElementById("tradeTotalLabel");
  const confirmBtn = document.getElementById("tradeConfirmBtn");
  const errorBox = document.getElementById("tradeError");

  errorBox.className = "modal-error";
  errorBox.textContent = "";
  qtyInput.value = "";
  dateInput.value = "";
  feesInput.value = "";

  const p = prices[h.symbol];
  const ltp = p ? p.ltp : null;

  if (mode === "buy") {
    titleEl.className = "modal-title buy";
    titleText.textContent = `Buy ${h.symbol}`;
    sub.textContent = `Currently holding ${h.qty} @ Rs ${fmt(h.avgCost, 2)} avg cost.`;
    qtyHint.textContent = "";
    priceInput.value = ltp !== null ? ltp.toFixed(2) : h.avgCost.toFixed(2);
    dateField.style.display = "block";
    feesField.style.display = "none";
    totalLabel.textContent = "Total cost";
    confirmBtn.textContent = "Confirm Buy";
    confirmBtn.className = "confirm-buy";
  } else {
    titleEl.className = "modal-title sell";
    titleText.textContent = `Sell ${h.symbol}`;
    sub.textContent = `You hold ${h.qty} shares @ Rs ${fmt(h.avgCost, 2)} avg cost.`;
    qtyHint.textContent = `Max ${h.qty} shares`;
    priceInput.value = ltp !== null ? ltp.toFixed(2) : "";
    dateField.style.display = "none";
    feesField.style.display = "block";
    totalLabel.textContent = "Realized P/L (gross)";
    confirmBtn.textContent = "Confirm Sell";
    confirmBtn.className = "confirm-sell";
  }

  updateTradeModalTotal();
  overlay.classList.add("show");
  qtyInput.focus();
}

function closeTradeModal() {
  document.getElementById("tradeModalOverlay").classList.remove("show");
  tradeModalState = { mode: null, holdingId: null };
}

function updateTradeModalTotal() {
  const { mode, holdingId } = tradeModalState;
  if (!mode) return;
  const h = holdings.find((x) => x.id == holdingId);
  if (!h) return;
  const qty = Number(document.getElementById("tradeQty").value);
  const price = Number(document.getElementById("tradePrice").value);
  const totalBox = document.getElementById("tradeTotalBox");
  const totalAmt = document.getElementById("tradeTotalAmt");

  if (mode === "buy") {
    const total = (qty > 0 && price > 0) ? qty * price : 0;
    totalBox.className = "modal-total";
    totalAmt.className = "amt";
    totalAmt.textContent = "Rs " + fmt(total, 0);
  } else {
    const pl = (qty > 0 && price > 0) ? (price - h.avgCost) * qty : 0;
    totalBox.className = "modal-total gain";
    totalAmt.className = "amt " + (pl >= 0 ? "pos" : "neg");
    totalAmt.textContent = (pl >= 0 ? "+" : "") + "Rs " + fmt(pl, 0);
  }
}

function confirmTrade() {
  const { mode, holdingId } = tradeModalState;
  if (!mode) return;
  const h = holdings.find((x) => x.id == holdingId);
  const errorBox = document.getElementById("tradeError");
  if (!h) { closeTradeModal(); return; }

  const qty = Number(document.getElementById("tradeQty").value);
  const price = Number(document.getElementById("tradePrice").value);
  const feesRaw = document.getElementById("tradeFees").value;
  const fees = feesRaw !== "" && !Number.isNaN(Number(feesRaw)) ? Number(feesRaw) : null;

  if (!qty || qty <= 0) {
    errorBox.textContent = "Enter a valid quantity.";
    errorBox.className = "modal-error show";
    return;
  }
  const priceRaw = document.getElementById("tradePrice").value;
  if (priceRaw === "" || Number.isNaN(price) || price < 0 || (mode === "sell" && price <= 0)) {
    errorBox.textContent = mode === "buy" ? "Enter a valid price (0 is allowed for bonus shares)." : "Enter a valid price.";
    errorBox.className = "modal-error show";
    return;
  }
  if (mode === "sell" && qty > h.qty) {
    errorBox.textContent = `You only hold ${h.qty} shares.`;
    errorBox.className = "modal-error show";
    return;
  }

  const p = getCurrentPortfolio();
  if (mode === "buy") {
    const dateStr = document.getElementById("tradeDate").value || null;
    p.transactions.push({ id: uid(), symbol: h.symbol, side: "buy", qty, price, date: dateStr, fees: null, note: "" });
  } else {
    const todayStr = new Date().toISOString().slice(0, 10);
    p.transactions.push({ id: uid(), symbol: h.symbol, side: "sell", qty, price, date: todayStr, fees, note: "" });
  }
  saveState();
  recompute();

  closeTradeModal();
  refresh();
  renderTransactions();
  renderPerformancePanel();
  renderDividends();
}

function buyHolding(id) { openTradeModal("buy", id); }
function sellHolding(id) { openTradeModal("sell", id); }

document.getElementById("tradeModalClose").addEventListener("click", closeTradeModal);
document.getElementById("tradeCancelBtn").addEventListener("click", closeTradeModal);
document.getElementById("tradeConfirmBtn").addEventListener("click", confirmTrade);
document.getElementById("tradeQty").addEventListener("input", updateTradeModalTotal);
document.getElementById("tradePrice").addEventListener("input", updateTradeModalTotal);
document.getElementById("tradeModalOverlay").addEventListener("click", (e) => {
  if (e.target.id === "tradeModalOverlay") closeTradeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("tradeModalOverlay").classList.contains("show")) closeTradeModal();
});

