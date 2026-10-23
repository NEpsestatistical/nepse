/* ---------- Security & Account Isolation Audit ---------- */
function updateSecAuditUI() {
  const uidEl = document.getElementById("secAuditUid");
  if (uidEl) {
    if (currentUserId) {
      const masked = currentUserId.length > 12 ? `${currentUserId.slice(0, 6)}...${currentUserId.slice(-6)}` : currentUserId;
      uidEl.textContent = `${masked} (authenticated)`;
    } else {
      uidEl.textContent = "Unauthenticated";
    }
  }

  const syncEl = document.getElementById("secAuditSync");
  if (syncEl) {
    const labels = {
      synced: { text: "Cloud reachable (client upsert/select)", color: "#3FA796" },
      saving: { text: "Saving…", color: "#D4A33A" },
      local_only: { text: "Local only — cloud not used", color: "#D4A33A" },
      error: { text: "Cloud error — verify table + RLS", color: "#C4553D" },
      unknown: { text: "Not checked yet", color: "#8C9BA5" },
    };
    const m = labels[syncStatus] || labels.unknown;
    syncEl.textContent = m.text;
    syncEl.style.color = m.color;
    syncEl.title = syncErrorMessage || "";
  }

  const rlsEl = document.getElementById("secAuditRls");
  if (rlsEl) {
    rlsEl.textContent = "Verify in Supabase dashboard (client cannot prove RLS)";
    rlsEl.style.color = "#D4A33A";
  }
}

async function runSecAuditTest() {
  const resEl = document.getElementById("secAuditResult");
  if (!resEl) return;
  resEl.textContent = "Running checks…";

  try {
    if (!currentUserId) throw new Error("No active authenticated session.");

    let otherUserKeys = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("ee_") && !k.endsWith("_" + currentUserId)) otherUserKeys++;
    }

    if (SUPABASE_ANON_KEY.includes("service_role")) {
      throw new Error("Service-role secret exposure detected!");
    }

    // Probe cloud table
    const { error } = await sb
      .from("portfolio_data")
      .select("user_id")
      .eq("user_id", currentUserId)
      .maybeSingle();

    let cloudLine = "";
    if (error) {
      cloudLine = ` Cloud probe failed: ${formatSupabaseError(error)}`;
    } else {
      cloudLine = " Cloud probe OK for this user_id.";
    }

    const keyNote = otherUserKeys
      ? ` Note: ${otherUserKeys} localStorage key(s) exist for other account(s) on this browser (expected if multiple logins); active session only uses this UID.`
      : " Local cache keys scoped to this UID.";

    resEl.innerHTML = `<span style="color:#3FA796; font-weight:600;">✓ Client checks passed.</span>
      <span style="color:#8C9BA5;">${esc(cloudLine)}${esc(keyNote)} RLS must still be confirmed in Supabase.</span>`;
  } catch (err) {
    resEl.innerHTML = `<span style="color:#FF7B60; font-weight:600;">⚠ Audit: ${esc(err.message)}</span>`;
  }
}

document.getElementById("secAuditTestBtn")?.addEventListener("click", runSecAuditTest);
