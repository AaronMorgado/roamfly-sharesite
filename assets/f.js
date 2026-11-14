"use strict";
/* /f/#<token>: loads a shared flight from the shared-flight function, refreshes every minute, draws it with share-card.js. */
(() => {
  const PROD_API = "https://fzafnoaqlfsbpzfeqpks.supabase.co/functions/v1/shared-flight";
  const REFRESH_MS = 60 * 1000;
  const { renderShareCard, cardTitle, esc, spoken } = window.RoamflyCard;
  const app = document.getElementById("app");
  const shareArea = document.getElementById("share-area");
  // A malformed link ("%" not followed by hex) must not break the page: treat it as no token.
  const token = (() => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ""; } })();

  // Local testing only: ?api=http://127.0.0.1:54321 when the page itself is served from localhost.
  function apiBase() {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const override = new URLSearchParams(location.search).get("api");
    return local && override ? `${override.replace(/\/$/, "")}/functions/v1/shared-flight` : PROD_API;
  }

  function render(f) {
    const m = renderShareCard(app, f, { heading: 1 });
    app.setAttribute("aria-busy", "false");
    announce(m);
    document.title = cardTitle(f, m);
    showShare(f);
  }

  /** Under a rendered flight: what sharing does, then the row. The link shared is this page's own (with the #token). */
  function showShare(f) {
    if (!shareArea || !window.RoamflyShare) return;
    const city = f.destination && (f.destination.city || f.destination.code);
    const text = city ? `Track this flight to ${city}` : "Track this flight";
    window.RoamflyShare.renderShareButtons(document.getElementById("share-buttons"), { url: location.href, text, title: text });
    shareArea.hidden = false;
  }

  function message(title, text, retry) {
    document.title = "Roamfly";
    if (shareArea) shareArea.hidden = true;
    app.setAttribute("aria-busy", "false");
    app.innerHTML = `<div class="card message tone-neutral"><h1>${esc(title)}</h1><p>${esc(text)}</p>${retry ? '<button type="button" id="retry">Try again</button>' : ""}</div>`;
    if (retry) document.getElementById("retry").addEventListener("click", load);
  }

  let last = null, timer = null, lastStatus = null;
  // Screen readers: announce only real changes, not the whole card on every minute's refresh.
  function announce(m) {
    const key = `${m.phase}|${m.line || ""}`;
    if (lastStatus !== null && key !== lastStatus) {
      document.getElementById("announce").textContent = spoken(`Status update: ${m.phase}${m.line ? ", " + m.line : ""}`);
    }
    lastStatus = key;
  }
  async function load() {
    if (!/^[A-Za-z0-9_-]{22,64}$/.test(token)) return message("This link is no longer active", "Ask for a new link to follow this flight.");
    try {
      const res = await fetch(`${apiBase()}?t=${encodeURIComponent(token)}`, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
      if (res.status === 404) { last = null; return message("This link is no longer active", "Sharing was turned off or the flight ended more than a day ago."); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = await res.json();
      if (safeRender(fresh)) { last = fresh; return; }
      if (!last || !safeRender(last)) message("Can't show this flight", "Something in this flight's details couldn't be displayed. Try again in a minute.", true);
    } catch {
      // Network or server trouble: keep the last good view; the next refresh retries.
      if (!last || !safeRender(last)) message("Can't load this flight", "Check your connection and try again.", true);
    }
  }

  /** Renders, or returns false instead of leaving a half-drawn or blank page. */
  function safeRender(f) {
    try { render(f); return true; } catch { return false; }
  }
  function schedule() {
    clearInterval(timer);
    if (document.visibilityState === "visible") timer = setInterval(load, REFRESH_MS);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); schedule(); });
  window.addEventListener("hashchange", () => location.reload());
  load(); schedule();
})();
