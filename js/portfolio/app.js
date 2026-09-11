// Window attachments for inline event handlers
window.quickTradeFromWatchlist = quickTradeFromWatchlist;
window.quickAlertFromWatchlist = quickAlertFromWatchlist;
window.editWatchlistItem = editWatchlistItem;
window.deleteWatchlistItem = deleteWatchlistItem;
window.rearmAlert = rearmAlert;
window.dismissTriggeredAlert = dismissTriggeredAlert;
window.toggleAlertEnabled = toggleAlertEnabled;
window.deleteAlert = deleteAlert;
window.editAlert = editAlert;


const VALID_VIEWS = ["overview", "holdings", "activity", "analysis", "watchlist", "health", "alerts", "settings"];
function showView(name) {
  if (!VALID_VIEWS.includes(name)) name = "overview";
  document.querySelectorAll(".app-view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".app-nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  const el = document.getElementById("view-" + name);
  if (el) el.classList.add("active");
  if (name === "activity") { document.getElementById("txPanel")?.classList.add("show"); document.getElementById("divPanel")?.classList.add("show"); }
  if (name === "analysis") { document.getElementById("unrealPanel")?.classList.add("show"); document.getElementById("sectorPanel")?.classList.add("show"); document.getElementById("topPerfPanel")?.classList.add("show"); if (typeof renderTopPerformers === "function") renderTopPerformers(); }
  if (name === "watchlist") { renderWatchlist(); updateWatchlistFormHint(); }
  if (name === "health") { renderHealthPanel(); renderPortfolioHealth(); }
  if (name === "alerts") { renderAlerts(); updateAlertFormUI(); }
  if (name === "settings") { document.getElementById("settingsBox")?.classList.add("show"); updateSecAuditUI(); }
  if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
}
document.querySelectorAll(".app-nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});
document.getElementById("txBtn")?.addEventListener("click", () => showView("activity"));
document.getElementById("divBtn")?.addEventListener("click", () => showView("activity"));
document.getElementById("unrealBtn")?.addEventListener("click", () => showView("analysis"));
document.getElementById("perfBtn")?.addEventListener("click", () => showView("analysis"));
document.getElementById("sectorBtn")?.addEventListener("click", () => showView("analysis"));
document.getElementById("topPerfBtn")?.addEventListener("click", () => showView("analysis"));
document.getElementById("settingsBtn")?.addEventListener("click", () => showView("settings"));
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
showView(location.hash.slice(1) || "overview");

let refreshIntervalId = null;
checkAuthAndBoot();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  } else if (!refreshIntervalId) {
    refresh();
    refreshIntervalId = setInterval(refresh, 30000);
  }
});

(function initTargetCursor() {
  const CURSOR_COLOR = "#ffffff";
  const CURSOR_COLOR_ON_TARGET = "#B497CF";
  const cursor = document.getElementById("tcCursor");
  if (!cursor || window.matchMedia("(pointer: coarse)").matches) return;

  document.documentElement.classList.add("tc-active");
  document.documentElement.style.setProperty("--tc-color", CURSOR_COLOR);

  let raf = null, targetX = 0, targetY = 0;
  function moveCursor() {
    cursor.style.transform = `translate(${targetX}px, ${targetY}px)`;
    raf = null;
  }
  document.addEventListener("mousemove", (e) => {
    targetX = e.clientX; targetY = e.clientY;
    cursor.classList.add("tc-visible");
    if (!raf) raf = requestAnimationFrame(moveCursor);
  });
  document.addEventListener("mouseleave", () => cursor.classList.remove("tc-visible"));

  function snapTo(el) {
    const r = el.getBoundingClientRect();
    cursor.style.width = r.width + 12 + "px";
    cursor.style.height = r.height + 12 + "px";
    cursor.style.marginLeft = -(r.width + 12) / 2 + "px";
    cursor.style.marginTop = -(r.height + 12) / 2 + "px";
    cursor.style.transform = `translate(${r.left + r.width / 2}px, ${r.top + r.height / 2}px)`;
    cursor.classList.add("tc-on-target");
    cursor.style.setProperty("--tc-color", CURSOR_COLOR_ON_TARGET);
    document.documentElement.style.setProperty("--tc-color", CURSOR_COLOR_ON_TARGET);
  }
  function unsnap() {
    cursor.style.width = "32px";
    cursor.style.height = "32px";
    cursor.style.marginLeft = "-16px";
    cursor.style.marginTop = "-16px";
    cursor.classList.remove("tc-on-target");
    document.documentElement.style.setProperty("--tc-color", CURSOR_COLOR);
  }

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest(".cursor-target, .btn, .add-btn, .buy-btn, .sell-btn, .p-tab, .p-tab-add, input, select");
    if (target) snapTo(target);
  });
  document.addEventListener("mouseout", (e) => {
    const target = e.target.closest(".cursor-target, .btn, .add-btn, .buy-btn, .sell-btn, .p-tab, .p-tab-add, input, select");
    const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(".cursor-target, .btn, .add-btn, .buy-btn, .sell-btn, .p-tab, .p-tab-add, input, select") : null;
    if (target && !to) unsnap();
  });
})();

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-3d");
  if (!btn) return;
  btn.classList.remove("pulse");
  void btn.offsetWidth;
  btn.classList.add("pulse");
  setTimeout(() => btn.classList.remove("pulse"), 500);
});

(function initPortfolio3D() {
  const cards = document.querySelectorAll(".stats .stat");
  if (!cards.length) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  cards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const px = x / rect.width;
      const py = y / rect.height;
      const rotateY = (px - 0.5) * 6;
      const rotateX = (0.5 - py) * 5;
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px) translateZ(10px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "perspective(900px) translateZ(0)";
    });
  });
})();
