/* Live price feed — not exposed in the UI on purpose. */
const WORKER_URL = "https://shiny-term-f599.bharatiaashish43.workers.dev";
function getWorkerUrl() { return WORKER_URL; }

/* ---------- Auth (Supabase) ---------- */
const SUPABASE_URL = "https://bfuatuhoosiwaugcxhjt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdWF0dWhvb3Npd2F1Z2N4aGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNzIxNTksImV4cCI6MjEwMTg0ODE1OX0.0eGEG6MDysnAx8P08xdf9hQxzBTl1erQRNxFOh4ZQDI";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUserId = null;

sb.auth.onAuthStateChange((event, session) => {
  const sessionUserId = session?.user?.id || null;
  if (currentUserId && sessionUserId && sessionUserId !== currentUserId) {
    location.reload();
  }
});

function lgSetMsg(text, ok) {
  const el = document.getElementById("lgMsg");
  el.textContent = text || "";
  el.classList.toggle("ok", !!ok);
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

async function lgSignIn() {
  const email = document.getElementById("lgEmail").value.trim().toLowerCase();
  const password = document.getElementById("lgPassword").value;
  if (!validEmail(email)) { lgSetMsg("Enter a valid email address."); return; }
  if (!password) { lgSetMsg("Enter your password."); return; }
  lgSetMsg("Signing in…", true);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { lgSetMsg(error.message); return; }
  await bootForUser(data.user.id);
}
async function lgSignUp() {
  const email = document.getElementById("lgEmail").value.trim().toLowerCase();
  const password = document.getElementById("lgPassword").value;
  if (!validEmail(email)) { lgSetMsg("Enter a valid email address."); return; }
  if (password.length < 6) { lgSetMsg("Password should be at least 6 characters."); return; }
  lgSetMsg("Creating account…", true);
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) { lgSetMsg(error.message); return; }
  if (data.session) { await bootForUser(data.user.id); }
  else { lgSetMsg("Check your inbox to confirm your email, then sign in.", true); }
}
function lgSignOut() {
  // Purge all in-memory portfolio state immediately to ensure zero cross-account leakage
  portfolios = [];
  currentPortfolioId = null;
  holdings = [];
  prices = {};
  prevPrices = {};
  currentUserId = null;
  if (typeof refreshIntervalId !== "undefined" && refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
  sb.auth.signOut().finally(() => location.reload());
}
document.getElementById("lgSignInBtn").addEventListener("click", lgSignIn);
document.getElementById("lgSignUpBtn").addEventListener("click", lgSignUp);
document.getElementById("lgSignOutBtn").addEventListener("click", lgSignOut);
document.getElementById("lgPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") lgSignIn(); });

async function checkAuthAndBoot() {
  document.getElementById("lgFormArea").style.display = "none";
  document.getElementById("lgLoadingArea").style.display = "block";
  const { data } = await sb.auth.getSession();
  if (data.session && data.session.user) {
    await bootForUser(data.session.user.id);
  } else {
    document.getElementById("lgFormArea").style.display = "block";
    document.getElementById("lgLoadingArea").style.display = "none";
  }
}
async function bootForUser(userId) {
  currentUserId = userId;
  portfolios = [];
  currentPortfolioId = null;
  holdings = [];
  prices = {};
  prevPrices = {};
  document.getElementById("loginGate").classList.add("hide");
  await loadState();
  recompute();
  renderPortfolioTabs();
  render();
  refresh();
  renderTransactions();
  renderDividends();
  renderWatchlist();
  evaluateAlerts();
  updateSecAuditUI();
  if (typeof refreshIntervalId !== "undefined" && refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(refresh, 30000);
}

