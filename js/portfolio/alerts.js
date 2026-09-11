/* ---------- Alerts Workspace (Checkpoint 08) ---------- */
let alertsActiveFilter = "all";

function getAlerts() {
  const p = getCurrentPortfolio();
  if (!p) return [];
  if (!Array.isArray(p.alerts)) p.alerts = [];
  return p.alerts;
}

function updateAlertsNavBadge(triggeredCount) {
  const badge = document.getElementById("alertsBadge");
  if (!badge) return;
  if (triggeredCount > 0) {
    badge.textContent = `${triggeredCount} TRIGGERED`;
    badge.style.display = "inline-block";
    badge.classList.add("has-triggered");
  } else {
    const list = getAlerts();
    if (list.length > 0) {
      badge.textContent = list.length;
      badge.style.display = "inline-block";
      badge.classList.remove("has-triggered");
    } else {
      badge.style.display = "none";
      badge.classList.remove("has-triggered");
    }
  }
}

function getAlertCurrentValue(alert) {
  if (alert.type === "portfolio_val") {
    let totalVal = 0;
    holdings.forEach(h => {
      const pr = prices[h.symbol];
      totalVal += (pr?.ltp ?? h.avgCost) * h.qty;
    });
    return { val: totalVal, display: "Rs " + fmt(totalVal, 2), hasData: true };
  }
  if (alert.type === "portfolio_day_pl") {
    let totalDayChange = 0;
    let anyChange = false;
    holdings.forEach(h => {
      const pr = prices[h.symbol];
      const ltp = pr ? pr.ltp : null;
      const dayChg = getDayChange(pr, ltp);
      if (dayChg && h.qty) {
        anyChange = true;
        totalDayChange += dayChg.amt * h.qty;
      }
    });
    return {
      val: totalDayChange,
      display: (totalDayChange >= 0 ? "+" : "") + "Rs " + fmt(totalDayChange, 2),
      hasData: anyChange || holdings.length === 0
    };
  }

  const sym = (alert.symbol || "").trim().toUpperCase();
  if (!sym) return { val: null, display: "—", hasData: false };
  const pr = prices[sym];
  if (!pr || pr.ltp === undefined || pr.ltp === null) {
    return { val: null, display: "Waiting for feed…", hasData: false };
  }

  if (alert.type === "price_target") {
    return { val: pr.ltp, display: "Rs " + fmt(pr.ltp, 2), hasData: true };
  }
  if (alert.type === "price_pct_up" || alert.type === "price_pct_down") {
    const dayChg = getDayChange(pr, pr.ltp);
    if (!dayChg) return { val: null, display: "No day data", hasData: false };
    return {
      val: dayChg.pct,
      display: (dayChg.pct >= 0 ? "+" : "") + fmt(dayChg.pct, 2) + "%",
      hasData: true
    };
  }
  return { val: null, display: "—", hasData: false };
}

function getAlertTargetLabel(a) {
  if (a.type.startsWith("portfolio_")) return "Total Portfolio";
  return a.symbol || "Stock";
}

function getAlertConditionLabel(a) {
  const condSymbol = a.condition === "lte" ? "≤" : "≥";
  if (a.type === "price_target") return `Price ${condSymbol} Rs ${fmt(Number(a.threshold), 2)}`;
  if (a.type === "price_pct_up") return `Gain ≥ ${fmt(Number(a.threshold), 2)}%`;
  if (a.type === "price_pct_down") return `Drop ≤ ${fmt(Number(a.threshold), 2)}%`;
  if (a.type === "portfolio_val") return `Portfolio Val ${condSymbol} Rs ${fmt(Number(a.threshold), 2)}`;
  if (a.type === "portfolio_day_pl") return `Day P/L ${condSymbol} Rs ${fmt(Number(a.threshold), 2)}`;
  return `Target ${condSymbol} ${a.threshold}`;
}

function evaluateAlerts() {
  const alerts = getAlerts();
  let newlyTriggered = 0;
  let triggeredActiveCount = 0;

  alerts.forEach(a => {
    if (!a.enabled) return;
    const cur = getAlertCurrentValue(a);
    if (!cur || cur.val === null || isNaN(cur.val) || !cur.hasData) return;

    let isTriggered = false;
    const th = Number(a.threshold) || 0;
    const isGte = a.condition !== "lte";

    if (a.type === "price_target" || a.type === "portfolio_val" || a.type === "portfolio_day_pl") {
      if (isGte && cur.val >= th) isTriggered = true;
      if (!isGte && cur.val <= th) isTriggered = true;
    } else if (a.type === "price_pct_up") {
      if (cur.val >= th) isTriggered = true;
    } else if (a.type === "price_pct_down") {
      const dropThreshold = th > 0 ? -th : th;
      if (cur.val <= dropThreshold) isTriggered = true;
    }

    if (isTriggered) {
      if (a.status !== "triggered") {
        a.status = "triggered";
        a.lastTriggeredAt = new Date().toISOString();
        newlyTriggered++;
      }
      triggeredActiveCount++;
    }
  });

  if (newlyTriggered > 0) {
    saveState();
  }
  updateAlertsNavBadge(triggeredActiveCount);
  renderAlerts();
}

function renderAlerts() {
  const alerts = getAlerts();

  const total = alerts.length;
  const active = alerts.filter(a => a.enabled && a.status !== "triggered").length;
  const triggered = alerts.filter(a => a.enabled && a.status === "triggered").length;
  const paused = alerts.filter(a => !a.enabled).length;

  const statTotal = document.getElementById("alertStatTotal");
  const statActive = document.getElementById("alertStatActive");
  const statTriggered = document.getElementById("alertStatTriggered");
  const statPaused = document.getElementById("alertStatPaused");
  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = active;
  if (statTriggered) statTriggered.textContent = triggered;
  if (statPaused) statPaused.textContent = paused;

  updateAlertsNavBadge(triggered);

  // Active triggered banner
  const banner = document.getElementById("alertsActiveBanner");
  const triggeredAlerts = alerts.filter(a => a.enabled && a.status === "triggered");
  if (banner) {
    if (triggeredAlerts.length > 0) {
      banner.style.display = "block";
      banner.innerHTML = `
        <div style="background:rgba(196,85,61,0.15); border:1px solid rgba(196,85,61,0.4); border-radius:8px; padding:12px 16px; margin-bottom:16px;">
          <div style="color:#FF7B60; font-weight:700; font-size:13px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <span>⚡</span> <span>${triggeredAlerts.length} Alert${triggeredAlerts.length > 1 ? "s" : ""} Currently Triggered!</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${triggeredAlerts.map(a => {
              const cur = getAlertCurrentValue(a);
              const target = getAlertTargetLabel(a);
              const cond = getAlertConditionLabel(a);
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#14181C; padding:8px 12px; border-radius:6px; font-size:12px; flex-wrap:wrap; gap:8px;">
                  <div>
                    <strong style="color:#EDEFF1;">${esc(target)}</strong>:
                    <span style="color:#FF7B60; margin-left:6px;">${esc(cond)}</span>
                    <span style="color:#8C9BA5; margin-left:8px;">(Live: ${esc(cur.display)})</span>
                    ${a.note ? `<span style="color:#6B7680; margin-left:8px;">— "${esc(a.note)}"</span>` : ""}
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button class="alert-action-btn rearm" onclick="rearmAlert('${escAttr(a.id)}')">Re-arm</button>
                    <button class="alert-action-btn" onclick="dismissTriggeredAlert('${escAttr(a.id)}')">Dismiss</button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    } else {
      banner.style.display = "none";
      banner.innerHTML = "";
    }
  }

  // Alerts table
  const tbody = document.getElementById("alertsTableBody");
  if (!tbody) return;

  let filtered = alerts.filter(a => {
    if (alertsActiveFilter === "active") return a.enabled && a.status !== "triggered";
    if (alertsActiveFilter === "triggered") return a.enabled && a.status === "triggered";
    if (alertsActiveFilter === "paused") return !a.enabled;
    return true;
  });

  if (filtered.length === 0) {
    if (alerts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:28px 16px; text-align:center; color:#8C9BA5;">No price or portfolio alerts created yet. Use the form above to add an alert.</td></tr>`;
    } else {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:20px; text-align:center; color:#8C9BA5;">No alerts match the active filter.</td></tr>`;
    }
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const target = getAlertTargetLabel(a);
    const cond = getAlertConditionLabel(a);
    const cur = getAlertCurrentValue(a);
    const isTriggered = a.enabled && a.status === "triggered";
    const isPaused = !a.enabled;

    let statusPill = "";
    if (isTriggered) {
      statusPill = `<span class="alert-tag triggered" style="box-shadow:0 0 8px rgba(196,85,61,0.5);">⚡ TRIGGERED</span>`;
    } else if (isPaused) {
      statusPill = `<span class="alert-tag paused">PAUSED</span>`;
    } else {
      statusPill = `<span class="alert-tag active">ACTIVE</span>`;
    }

    const triggeredTime = a.lastTriggeredAt
      ? new Date(a.lastTriggeredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "—";

    return `
      <tr>
        <td style="font-weight:600; color:#EDEFF1;">${esc(target)}</td>
        <td style="color:#EDEFF1;">${esc(cond)}</td>
        <td style="font-weight:600; color:${isTriggered ? '#FF7B60' : '#EDEFF1'};">${esc(cur.display)}</td>
        <td style="color:#8C9BA5; font-size:11.5px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escAttr(a.note || '')}">
          ${esc(a.note || "—")}
        </td>
        <td>${statusPill}</td>
        <td style="color:#6B7680; font-size:11px;">${esc(triggeredTime)}</td>
        <td style="text-align:right; white-space:nowrap;">
          ${isTriggered ? `<button class="alert-action-btn rearm" onclick="rearmAlert('${escAttr(a.id)}')" title="Reset status to pending">Re-arm</button>` : ""}
          <button class="alert-action-btn" onclick="toggleAlertEnabled('${escAttr(a.id)}')" title="${a.enabled ? 'Pause' : 'Resume'}">
            ${a.enabled ? "Pause" : "Resume"}
          </button>
          <button class="alert-action-btn" onclick="editAlert('${escAttr(a.id)}')" title="Edit threshold or note">Edit</button>
          <button class="alert-action-btn del" onclick="deleteAlert('${escAttr(a.id)}')" title="Delete alert">✕</button>
        </td>
      </tr>
    `;
  }).join("");
}

function updateAlertFormUI() {
  const typeSelect = document.getElementById("alertTypeSelect");
  const symField = document.getElementById("alertSymbolField");
  const condField = document.getElementById("alertConditionField");
  const thLabel = document.getElementById("alertThresholdLabel");
  const thInput = document.getElementById("alertThresholdInput");
  const preview = document.getElementById("alertLivePreview");
  if (!typeSelect || !symField || !condField || !thLabel || !thInput) return;

  const type = typeSelect.value;
  if (type === "price_target") {
    symField.style.display = "flex";
    condField.style.display = "flex";
    thLabel.textContent = "Target Price (Rs)";
    thInput.placeholder = "e.g. 520";
  } else if (type === "price_pct_up") {
    symField.style.display = "flex";
    condField.style.display = "none";
    thLabel.textContent = "Min Intraday Gain (%)";
    thInput.placeholder = "e.g. 4.5";
  } else if (type === "price_pct_down") {
    symField.style.display = "flex";
    condField.style.display = "none";
    thLabel.textContent = "Max Intraday Drop (%)";
    thInput.placeholder = "e.g. 3.0";
  } else if (type === "portfolio_val") {
    symField.style.display = "none";
    condField.style.display = "flex";
    thLabel.textContent = "Portfolio Value (Rs)";
    thInput.placeholder = "e.g. 1000000";
  } else if (type === "portfolio_day_pl") {
    symField.style.display = "none";
    condField.style.display = "flex";
    thLabel.textContent = "Day's P/L Amount (Rs)";
    thInput.placeholder = "e.g. 5000";
  }

  // Update live preview
  if (preview) {
    const sym = document.getElementById("alertSymbolInput")?.value.trim().toUpperCase();
    if (!type.startsWith("portfolio_") && sym) {
      const pr = prices[sym];
      if (pr && pr.ltp) {
        preview.textContent = `Live LTP for ${sym}: Rs ${fmt(pr.ltp, 2)}`;
      } else {
        preview.textContent = `Live price for ${sym} will update with feed.`;
      }
    } else if (type === "portfolio_val") {
      let totalVal = 0;
      holdings.forEach(h => {
        const pr = prices[h.symbol];
        totalVal += (pr?.ltp ?? h.avgCost) * h.qty;
      });
      preview.textContent = `Current Total Portfolio Value: Rs ${fmt(totalVal, 2)}`;
    } else {
      preview.textContent = "";
    }
  }
}

function createAlertFromForm() {
  const typeSelect = document.getElementById("alertTypeSelect");
  const symInput = document.getElementById("alertSymbolInput");
  const condSelect = document.getElementById("alertConditionSelect");
  const thInput = document.getElementById("alertThresholdInput");
  const noteInput = document.getElementById("alertNoteInput");

  const type = typeSelect?.value || "price_target";
  const rawTh = thInput?.value.trim();
  if (!rawTh || isNaN(Number(rawTh))) {
    appAlert({ title: "Invalid Target", message: "Please enter a valid numeric target or threshold." });
    return;
  }
  const threshold = Number(rawTh);

  let symbol = "";
  if (!type.startsWith("portfolio_")) {
    symbol = (symInput?.value || "").trim().toUpperCase();
    if (!symbol) {
      appAlert({ title: "Symbol Required", message: "Please enter a stock symbol (e.g. NABIL)." });
      return;
    }
  }

  let condition = condSelect?.value || "gte";
  if (type === "price_pct_up") condition = "gte";
  if (type === "price_pct_down") condition = "lte";

  const note = (noteInput?.value || "").trim();

  const newAlert = {
    id: uid(),
    type,
    symbol,
    condition,
    threshold,
    note,
    enabled: true,
    status: "pending",
    createdAt: new Date().toISOString(),
    lastTriggeredAt: null,
  };

  const p = getCurrentPortfolio();
  if (!p) return;
  if (!Array.isArray(p.alerts)) p.alerts = [];
  p.alerts.unshift(newAlert);

  saveState();
  if (thInput) thInput.value = "";
  if (noteInput) noteInput.value = "";

  evaluateAlerts();
  refresh();
}

function toggleAlertEnabled(id) {
  const alerts = getAlerts();
  const alert = alerts.find(a => a.id === id);
  if (!alert) return;
  alert.enabled = !alert.enabled;
  if (alert.enabled && alert.status === "triggered") {
    alert.status = "pending";
  }
  saveState();
  evaluateAlerts();
}

function rearmAlert(id) {
  const alerts = getAlerts();
  const alert = alerts.find(a => a.id === id);
  if (!alert) return;
  alert.status = "pending";
  alert.enabled = true;
  saveState();
  evaluateAlerts();
}

function dismissTriggeredAlert(id) {
  const alerts = getAlerts();
  const alert = alerts.find(a => a.id === id);
  if (!alert) return;
  alert.status = "dismissed";
  saveState();
  evaluateAlerts();
}

function deleteAlert(id) {
  const alerts = getAlerts();
  const alert = alerts.find(a => a.id === id);
  if (!alert) return;

  appConfirm({
    title: "Delete Alert?",
    message: `Are you sure you want to delete this alert for ${esc(getAlertTargetLabel(alert))}?`,
    confirmText: "Delete",
    danger: true,
    onConfirm: () => {
      const p = getCurrentPortfolio();
      if (!p || !Array.isArray(p.alerts)) return;
      p.alerts = p.alerts.filter(a => a.id !== id);
      saveState();
      evaluateAlerts();
    }
  });
}

function editAlert(id) {
  const alerts = getAlerts();
  const alert = alerts.find(a => a.id === id);
  if (!alert) return;

  appPrompt({
    title: `Edit Alert Threshold (${esc(getAlertTargetLabel(alert))})`,
    placeholder: "Numeric target or threshold",
    defaultValue: String(alert.threshold),
    confirmText: "Save",
    onSubmit: (val) => {
      const n = Number(val);
      if (isNaN(n) || val.trim() === "") {
        appAlert({ title: "Invalid Number", message: "Please enter a valid numeric threshold." });
        return;
      }
      alert.threshold = n;
      alert.status = "pending";
      saveState();
      evaluateAlerts();
    }
  });
}


// Event Listeners for Alerts Workspace
document.getElementById("createAlertBtn")?.addEventListener("click", createAlertFromForm);
document.getElementById("alertTypeSelect")?.addEventListener("change", updateAlertFormUI);
document.getElementById("alertSymbolInput")?.addEventListener("input", updateAlertFormUI);
document.querySelectorAll("[data-alert-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-alert-filter]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    alertsActiveFilter = btn.dataset.alertFilter;
    renderAlerts();
  });
});

