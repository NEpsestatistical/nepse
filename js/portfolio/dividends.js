function getDividends() {
  const p = getCurrentPortfolio();
  if (!p.dividends) p.dividends = [];
  return p.dividends;
}

function renderDividendsBySymbol(divs) {
  const wrap = document.getElementById("divBySymbolWrap");
  if (!wrap) return;
  if (!divs.length) { wrap.innerHTML = ""; return; }

  const bySymbol = {};
  divs.forEach((d) => {
    const sym = d.symbol || "—";
    if (!bySymbol[sym]) bySymbol[sym] = { symbol: sym, total: 0, count: 0, lastDate: null };
    bySymbol[sym].total += Number(d.amount) || 0;
    bySymbol[sym].count += 1;
    if (!bySymbol[sym].lastDate || (d.date || "") > bySymbol[sym].lastDate) bySymbol[sym].lastDate = d.date;
  });

  const rows = Object.values(bySymbol).sort((a, b) => b.total - a.total);

  wrap.innerHTML = `
    <div class="stat-label label" style="margin-top:18px;">All-Time Dividends — By Symbol</div>
    <table class="stock-perf-table">
      <thead><tr><th>Symbol</th><th>Total Received</th><th># Payments</th><th>Last Payment</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td class="sym">${esc(r.symbol)}</td>
            <td class="up">Rs ${fmt(r.total, 2)}</td>
            <td class="muted">${r.count}</td>
            <td class="muted">${esc(r.lastDate || "not set")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderDividends() {
  const divs = getDividends();
  const body = document.getElementById("divTableBody");
  if (!divs.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">No dividends logged yet for this portfolio.</td></tr>';
  } else {
    const sorted = [...divs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    body.innerHTML = sorted.map((d) => `
      <tr>
        <td>${d.date || "not set"}</td>
        <td class="sym">${esc(d.symbol)}</td>
        <td class="up">Rs ${fmt(d.amount, 2)}</td>
        <td class="muted">${esc(d.note || "")}</td>
        <td><button class="remove-btn" data-id="${d.id}" title="Delete">✕</button></td>
      </tr>
    `).join("");
    body.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        appConfirm({
          title: "Delete dividend entry?",
          message: "This only removes the dividend record — it doesn't affect your holdings or cost basis.",
          confirmText: "Delete",
          danger: true,
          onConfirm: () => {
            const p = getCurrentPortfolio();
            p.dividends = p.dividends.filter((x) => x.id !== btn.dataset.id);
            saveState();
            renderDividends();
          },
        });
      });
    });
  }
  const total = divs.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  document.getElementById("divTotal").textContent = "Rs " + fmt(total, 2);
  renderDividendsBySymbol(divs);
  renderSectorBreakdown();
}

document.getElementById("divBtn").addEventListener("click", () => {
  document.getElementById("divPanel").classList.toggle("show");
  renderDividends();
});

document.getElementById("divAddBtn").addEventListener("click", () => {
  const date = document.getElementById("divDateInput").value || null;
  const symbol = document.getElementById("divSymbolInput").value.trim().toUpperCase();
  const amount = Number(document.getElementById("divAmountInput").value);
  const note = document.getElementById("divNoteInput").value.trim();

  if (!symbol) { appAlert({ title: "Missing symbol", message: "Enter the stock symbol this dividend is from." }); return; }
  if (!amount || amount <= 0 || Number.isNaN(amount)) { appAlert({ title: "Invalid amount", message: "Enter a valid dividend amount." }); return; }

  const p = getCurrentPortfolio();
  if (!p.dividends) p.dividends = [];
  p.dividends.push({ id: uid(), date, symbol, amount, note });
  saveState();

  document.getElementById("divDateInput").value = "";
  document.getElementById("divSymbolInput").value = "";
  document.getElementById("divAmountInput").value = "";
  document.getElementById("divNoteInput").value = "";
  renderDividends();
});
