function renderTransactions() {
  const body = document.getElementById("txTableBody");
  if (!body) return;
  const p = getCurrentPortfolio();
  body.innerHTML = "";
  if (!p.transactions.length) {
    body.innerHTML = '<tr><td colspan="10" class="empty-state">No transactions yet.</td></tr>';
    return;
  }

  const validTrades = (p.transactions || []).filter((t) => t.symbol && t.side && t.qty > 0 && t.price >= 0);
  const { perTransaction, realizedPL: rplFromTrades } = buildFIFOAnalysis(validTrades);

  const sumTxPL = Object.values(perTransaction)
    .filter((a) => a.side === "sell")
    .reduce((s, a) => s + a.realizedPL, 0);
  if (Math.abs(sumTxPL - rplFromTrades) > 0.01) {
    console.warn("FIFO reconciliation mismatch: sum(transaction realized P/L) =", sumTxPL, "vs realizedPL =", rplFromTrades);
  }

  const sorted = [...p.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  sorted.forEach((t) => {
    const a = perTransaction[t.id];
    const row = document.createElement("tr");

    let costBasisCell = "—", proceedsCell = "—", plCell = "—", pctCell = "—", plClass = "";
    let fifoToggleHtml = "";

    if (a && a.side === "buy") {
      costBasisCell = "Rs " + fmt(a.costBasis, 2);
    } else if (a && a.side === "sell") {
      costBasisCell = "Rs " + fmt(a.costBasis, 2);
      proceedsCell = "Rs " + fmt(a.proceeds, 2);
      plClass = a.realizedPL > 0 ? "up" : a.realizedPL < 0 ? "down" : "";
      plCell = (a.realizedPL >= 0 ? "+" : "") + "Rs " + fmt(a.realizedPL, 2);
      pctCell = (a.realizedPLPercent >= 0 ? "+" : "") + fmt(a.realizedPLPercent, 2) + "%";
      if (a.matches.length) {
        fifoToggleHtml = `<button class="tx-fifo-toggle" data-id="${t.id}">▸ FIFO Details (${a.matches.length} match${a.matches.length > 1 ? "es" : ""})</button>`;
      }
      if (a.unmatchedQty > 0) {
        fifoToggleHtml += `<div class="faint" style="margin-top:4px;">⚠ ${a.unmatchedQty} shares sold with no matching buy lot</div>`;
      }
    }

    row.innerHTML = `
      <td>${t.date || "not set"}</td>
      <td class="sym">${esc(t.symbol)}</td>
      <td><span class="tx-side ${t.side}">${t.side}</span></td>
      <td>${t.qty}</td>
      <td>${fmt(t.price, 2)}</td>
      <td>${costBasisCell}</td>
      <td>${proceedsCell}</td>
      <td class="${plClass}">${plCell}${fifoToggleHtml}</td>
      <td class="${plClass}">${pctCell}</td>
      <td class="tx-actions">
        <button class="tx-edit" data-id="${t.id}">✎ Edit</button>
        <button class="tx-del" data-id="${t.id}">✕ Delete</button>
      </td>
    `;
    body.appendChild(row);

    if (a && a.side === "sell" && a.matches.length) {
      const detailRow = document.createElement("tr");
      detailRow.className = "tx-fifo-row";
      detailRow.style.display = "none";
      detailRow.dataset.fifoFor = t.id;
      const matchRows = a.matches.map((m) => `
        <div class="tx-fifo-match">
          <div class="muted">${m.qty} sh</div>
          <div><span class="m-label">Bought</span><br>${m.buyDate || "not set"}</div>
          <div><span class="m-label">Buy Price</span><br>Rs ${fmt(m.buyPrice, 2)}</div>
          <div><span class="m-label">Cost</span><br>Rs ${fmt(m.cost, 2)}</div>
          <div><span class="m-label">Sale Value</span><br>Rs ${fmt(m.proceeds, 2)}</div>
          <div><span class="m-label">Held</span><br>${m.holdingDays !== null ? m.holdingDays + "d (" + m.holdingTerm + ")" : "—"}</div>
          <div class="${m.realizedPL > 0 ? "up" : m.realizedPL < 0 ? "down" : ""}"><span class="m-label">Gain</span><br>${m.realizedPL >= 0 ? "+" : ""}Rs ${fmt(m.realizedPL, 2)}</div>
        </div>
      `).join("");
      const feeLine = a.fees !== null
        ? `<div class="fee-note">Selling charges: Rs ${fmt(a.fees, 2)} · Net proceeds: Rs ${fmt(a.netProceeds, 2)} · Net realized P/L: ${a.netRealizedPL >= 0 ? "+" : ""}Rs ${fmt(a.netRealizedPL, 2)}</div>`
        : `<div class="fee-note">No selling charges entered for this sale — figures above are gross.</div>`;
      detailRow.innerHTML = `
        <td colspan="10">
          <div class="tx-fifo-detail">
            <div class="fifo-title">FIFO Matches (this sell consumed the buy lot(s) below, oldest first)</div>
            ${matchRows}
            <div class="tx-fifo-total">
              <div></div>
              <div class="m-label">Total</div>
              <div></div>
              <div>Cost Basis<br>Rs ${fmt(a.costBasis, 2)}</div>
              <div>Sale Proceeds<br>Rs ${fmt(a.proceeds, 2)}</div>
              <div></div>
              <div class="${plClass}">Realized Gain<br>${plCell}<br>Return: ${pctCell}</div>
            </div>
            ${feeLine}
          </div>
        </td>
      `;
      body.appendChild(detailRow);
    }
  });

  body.querySelectorAll(".tx-fifo-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const detailRow = body.querySelector(`.tx-fifo-row[data-fifo-for="${btn.dataset.id}"]`);
      if (!detailRow) return;
      const isHidden = detailRow.style.display === "none";
      detailRow.style.display = isHidden ? "table-row" : "none";
      btn.textContent = btn.textContent.replace(isHidden ? "▸" : "▾", isHidden ? "▾" : "▸");
    });
  });

  body.querySelectorAll(".tx-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      appConfirm({
        title: "Delete transaction?",
        message: "Delete this transaction? Holdings and realized P/L will recalculate automatically.",
        confirmText: "Delete",
        danger: true,
        onConfirm: () => {
          const p = getCurrentPortfolio();
          p.transactions = p.transactions.filter((t) => t.id != btn.dataset.id);
          saveState();
          recompute();
          refresh();
          renderTransactions();
          renderPerformancePanel();
          renderDividends();
        },
      });
    });
  });

  body.querySelectorAll(".tx-edit").forEach((btn) => {
    btn.addEventListener("click", () => editTransactionRow(btn.dataset.id));
  });
}

function editTransactionRow(id) {
  const p = getCurrentPortfolio();
  const t = p.transactions.find((x) => x.id == id);
  if (!t) return;
  const row = document.querySelector(`.tx-del[data-id="${id}"]`)?.closest("tr");
  if (!row) return;
  row.innerHTML = `
    <td><input type="date" value="${t.date || ""}" class="edit-date" /></td>
    <td><input value="${esc(t.symbol)}" class="edit-symbol" style="text-transform:uppercase;" /></td>
    <td><select class="edit-side"><option value="buy" ${t.side === "buy" ? "selected" : ""}>Buy</option><option value="sell" ${t.side === "sell" ? "selected" : ""}>Sell</option></select></td>
    <td><input type="number" value="${t.qty}" class="edit-qty" /></td>
    <td><input type="number" value="${t.price}" class="edit-price" /></td>
    <td colspan="2"><input type="number" value="${t.fees !== null && t.fees !== undefined ? t.fees : ""}" class="edit-fees" placeholder="Charges (optional)" /></td>
    <td class="tx-actions" colspan="3">
      <button class="tx-save">✓ Save</button>
      <button class="tx-cancel">✕ Cancel</button>
    </td>
  `;
  row.querySelector(".tx-cancel").addEventListener("click", renderTransactions);
  row.querySelector(".tx-save").addEventListener("click", () => {
    const symbol = row.querySelector(".edit-symbol").value.trim().toUpperCase();
    const side = row.querySelector(".edit-side").value;
    const qty = Number(row.querySelector(".edit-qty").value);
    const price = Number(row.querySelector(".edit-price").value);
    const date = row.querySelector(".edit-date").value || null;
    const feesRaw = row.querySelector(".edit-fees").value;
    const fees = feesRaw !== "" && !Number.isNaN(Number(feesRaw)) ? Number(feesRaw) : null;
    if (!symbol || !qty || qty <= 0 || price < 0) { appAlert({ title: "Missing info", message: "Enter a valid symbol, quantity, and price." }); return; }
    t.symbol = symbol; t.side = side; t.qty = qty; t.price = price; t.date = date; t.fees = fees;
    saveState();
    recompute();
    refresh();
    renderTransactions();
    renderPerformancePanel();
    renderDividends();
  });
}

document.getElementById("txBtn").addEventListener("click", () => {
  document.getElementById("txPanel").classList.toggle("show");
  renderTransactions();
});

document.getElementById("txAddBtn").addEventListener("click", () => {
  const symbol = document.getElementById("txSymbolInput").value.trim().toUpperCase();
  const side = document.getElementById("txSideInput").value;
  const qty = Number(document.getElementById("txQtyInput").value);
  const price = Number(document.getElementById("txPriceInput").value);
  const date = document.getElementById("txDateInput").value || null;
  const feesRaw = document.getElementById("txFeesInput").value;
  const fees = feesRaw !== "" && !Number.isNaN(Number(feesRaw)) ? Number(feesRaw) : null;
  if (!symbol || !qty || qty <= 0 || price < 0) { appAlert({ title: "Missing info", message: "Enter a valid symbol, quantity, and price." }); return; }
  const p = getCurrentPortfolio();
  p.transactions.push({ id: uid(), symbol, side, qty, price, date, fees, note: "" });
  saveState();
  recompute();
  document.getElementById("txSymbolInput").value = "";
  document.getElementById("txQtyInput").value = "";
  document.getElementById("txPriceInput").value = "";
  document.getElementById("txDateInput").value = "";
  document.getElementById("txFeesInput").value = "";
  refresh();
  renderTransactions();
  renderPerformancePanel();
  renderDividends();
});

document.getElementById("perfBtn").addEventListener("click", () => {
  document.getElementById("perfPanel").classList.toggle("show");
  renderPerformancePanel();
  renderDividends();
});

