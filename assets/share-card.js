"use strict";
/*
 * Roamfly shared-flight card: one renderer for real shares (/f/) and the home page sample.
 * Pure drawing only — no network. Same rules as the app (Countdown, StatusTone, PhaseTrackModel).
 * The markup has no style attributes (the pages' CSP allows no inline styles); the plane's position is
 * set through the DOM after the HTML is in place.
 */
(() => {
  const DELAY_THRESHOLD = 15;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const d = (iso) => (iso ? new Date(iso) : null);
  // A time zone the browser doesn't know would make Intl throw; fall back to the viewer's own zone.
  const tzOK = new Map();
  const safeTz = (tz) => {
    if (!tz) return undefined;
    if (!tzOK.has(tz)) { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); tzOK.set(tz, true); } catch { tzOK.set(tz, false); } }
    return tzOK.get(tz) ? tz : undefined;
  };
  const time = (date, tz) => date ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: safeTz(tz) }).format(date) : "";
  const day = (date, tz) => date ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: safeTz(tz) }).format(date) : "";
  const zone = (date, tz) => {
    if (!date) return "";
    const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone: safeTz(tz) }).formatToParts(date).find((p) => p.type === "timeZoneName");
    return part ? part.value : "";
  };
  function duration(ms) {
    const total = Math.max(0, Math.floor(ms / 60000)), dd = Math.floor(total / 1440), h = Math.floor((total % 1440) / 60), m = total % 60;
    if (dd > 0) return h > 0 ? `${dd}d ${h}h` : `${dd}d`;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  }
  const spoken = (s) => s.replace(/\b(\d+)([dhm])\b/g, (_, n, u) => `${n} ${{ d: "day", h: "hour", m: "minute" }[u]}${n === "1" ? "" : "s"}`);
  const flightNo = (s) => { const c = String(s || "").toUpperCase(); const m = c.match(/^([A-Z0-9]{2}[A-Z]?)(\d+)$/); return m && /\d/.test(c.slice(m[1].length)) ? `${m[1]} ${m[2]}` : c; };

  /** Phase, headline, status line, tone and track: the same rules as the app (Countdown, StatusTone, PhaseTrackModel). */
  function model(f, now) {
    const t = Object.fromEntries(Object.entries(f.times).map(([k, v]) => [k, d(v)]));
    const expDep = t.estimatedDeparture || t.scheduledDeparture;
    const expArr = t.estimatedArrival || t.scheduledArrival;
    const late = f.delayMinutes >= DELAY_THRESHOLD;
    const statusLine = () => !f.live ? "Schedule only" : late ? `${duration(f.delayMinutes * 60000)} late` : f.status === "delayed" ? "Delayed" : "On time";
    const tone = f.status === "cancelled" || f.status === "diverted" ? "late"
      : f.status === "landed" || !f.live ? "neutral"
      : late || f.status === "delayed" ? "late" : "ontime";
    const third = 1 / 3;
    const airFrac = () => {
      const start = t.takeoffActual || t.takeoffEstimated || t.actualDeparture || expDep;
      const end = t.landingActual || t.landingEstimated || t.landingScheduled || expArr;
      if (!start || !end || end <= start) return .5;
      return Math.min(1, Math.max(0, (now - start) / (end - start)));
    };
    const landsAt = t.landingEstimated || t.landingScheduled || expArr;

    if (f.status === "cancelled") return { phase: "Cancelled", lead: "Cancelled", value: "", line: null, tone, progress: 0, reached: 0 };
    if (f.status === "landed") {
      if (t.actualArrival) {
        const lateBy = t.scheduledArrival ? Math.round((t.actualArrival - t.scheduledArrival) / 60000) : f.delayMinutes;
        return { phase: "Arrived", lead: "Landed", value: time(t.actualArrival, f.destination.timeZone),
          line: `At the gate ${lateBy >= DELAY_THRESHOLD ? `${duration(lateBy * 60000)} late` : "on time"}`, tone, progress: 1, reached: 4 };
      }
      return { phase: "Landed", lead: "Landed", value: "", line: statusLine(), tone, progress: 5 / 6, reached: 3 };
    }
    if (!f.live) { // schedule only: three steps, like the app
      if (now < t.scheduledDeparture) return { phase: "Upcoming", lead: "Departs in", value: duration(t.scheduledDeparture - now), line: "Schedule only", tone, progress: 0, reached: 0 };
      if (t.scheduledArrival && now < t.scheduledArrival) return { phase: "In flight", lead: "Lands in about", value: duration(t.scheduledArrival - now), line: "Schedule only", tone, progress: .5, reached: 2 };
      return { phase: "Completed", lead: "Completed", value: "", line: "Schedule only", tone, progress: 1, reached: 4 };
    }
    const airborne = f.status === "in_air" || f.status === "diverted" || (t.takeoffActual && t.takeoffActual <= now);
    if (airborne || (t.actualDeparture && t.actualDeparture <= now)) {
      const phase = f.status === "diverted" ? "Diverted" : airborne ? "In the air" : "Left the gate";
      const left = landsAt ? landsAt - now : null;
      return { phase, lead: left == null ? phase : left > 0 ? "Lands in" : "Landing now", value: left > 0 ? duration(left) : "",
        line: statusLine(), tone, progress: airborne ? third + airFrac() * third : third / 2, reached: airborne ? 2 : 1 };
    }
    const until = expDep - now;
    return { phase: f.status === "boarding" ? "Boarding" : "Upcoming", lead: until > 0 ? "Departs in" : "Departing now",
      value: until > 0 ? duration(until) : "", line: statusLine(), tone, progress: 0, reached: 0 };
  }

  function track(f, m) {
    const t = f.times, o = f.origin.timeZone, a = f.destination.timeZone;
    const stops = [
      [t.actualDeparture || t.estimatedDeparture || t.scheduledDeparture, o, "Gate", "Left the gate"],
      [t.takeoffActual || t.takeoffEstimated || t.takeoffScheduled, o, "Takeoff", "took off"],
      [t.landingActual || t.landingEstimated || t.landingScheduled, a, "Landing", "lands"],
      [t.actualArrival || t.estimatedArrival || t.scheduledArrival, a, "Gate", "at the gate"],
    ];
    const fill = m.tone === "neutral" ? "var(--text2)" : "var(--tone-text)";
    const x = (i) => 12.5 + i * 25; // % positions: centers of four columns
    const px = 12.5 + m.progress * 75;
    const dots = stops.map((_, i) => `<circle cx="${x(i)}%" cy="12" r="5" fill="${i < m.reached ? fill : "var(--surface)"}" stroke="${i < m.reached ? fill : "var(--neutral)"}" stroke-width="2"/>`).join("");
    const plane = m.progress > 0 && m.progress < 1
      ? `<span class="plane" data-left="${px}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="var(--surface)"/><path d="M4 12h15M14 6l5 6-5 6M7 8l2 4-2 4" stroke="${fill}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : "";
    const caps = stops.map(([iso, tz, name], i) => `<span class="${i < m.reached ? "on" : ""}">${esc(iso ? time(d(iso), tz) : name)}</span>`).join("");
    // Screen readers: "Left the gate 10:36, took off 10:52, lands 14:20, at the gate 14:30".
    const sentence = stops.filter(([iso]) => iso).map(([iso, tz, , words]) => `${words} ${time(d(iso), tz)}`).join(", ");
    const spokenSentence = sentence ? sentence[0].toUpperCase() + sentence.slice(1) : "";
    return `<div class="track" role="img" aria-label="${esc(spokenSentence || m.phase)}">
      <svg aria-hidden="true"><line x1="12.5%" y1="12" x2="87.5%" y2="12" stroke="var(--neutral)" stroke-width="3" stroke-linecap="round"/>
      <line x1="12.5%" y1="12" x2="${px}%" y2="12" stroke="${fill}" stroke-width="3" stroke-linecap="round"/>${dots}</svg>${plane}
      <div class="caps" aria-hidden="true">${caps}</div></div>`;
  }

  function leg(f, side) {
    const dep = side === "dep", t = f.times, end = dep ? f.origin : f.destination, tz = end.timeZone;
    const sched = d(dep ? t.scheduledDeparture : t.scheduledArrival);
    const best = d(dep ? (t.actualDeparture || t.estimatedDeparture || t.scheduledDeparture) : (t.actualArrival || t.estimatedArrival || t.scheduledArrival));
    const done = dep ? t.actualDeparture : t.actualArrival;
    const label = !f.live || f.status === "cancelled" ? (dep ? "Departure" : "Arrival") : dep ? (done ? "Departed" : "Departs") : (done ? "Arrived" : "Arrives");
    const diff = best && sched ? Math.round((best - sched) / 60000) : 0;
    const moved = f.live && sched && best && Math.abs(best - sched) >= 60000;
    const note = !f.live ? "" : diff >= DELAY_THRESHOLD ? `<b class="late">${duration(diff * 60000)} late</b> · ` : diff <= -5 ? `<b class="early">${duration(-diff * 60000)} early</b> · ` : "";
    let dayNote = "";
    if (!dep && best) {
      const depBest = d(t.actualDeparture || t.estimatedDeparture || t.scheduledDeparture);
      const ymd = (x, z) => new Intl.DateTimeFormat("en-CA", { timeZone: safeTz(z) }).format(x);
      const diffDays = Math.round((Date.parse(ymd(best, tz)) - Date.parse(ymd(depBest, f.origin.timeZone))) / 86400000);
      if (diffDays) dayNote = ` <span class="note day-shift">${diffDays > 0 ? "+" : "−"}${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? "s" : ""}</span>`;
    }
    const gate = dep ? f.gate : f.arrivalGate, term = dep ? f.terminal : f.arrivalTerminal;
    const chips = [term && `<span class="chip">Terminal <b>${esc(term)}</b></span>`, gate && `<span class="chip">Gate <b>${esc(gate)}</b></span>`].filter(Boolean).join("");
    return `<div class="leg"><div class="label">${label} · ${esc([end.code, end.city].filter(Boolean).join(" "))}</div>
      ${best ? `<div class="row"><span class="tile ${f.live && diff >= DELAY_THRESHOLD ? "late" : ""}">${esc(time(best, tz))}</span>${moved ? `<span class="was"><span class="sr-only">scheduled </span>${esc(time(sched, tz))}</span>` : ""}${dayNote}</div>
      <div class="note">${note}${esc(day(best, tz))} · ${esc(zone(best, tz))}</div>` : `<div class="note">Time not published yet</div>`}
      ${chips ? `<div class="chips">${chips}</div>` : ""}</div>`;
  }

  /**
   * Draws the card into `container` and returns the model (phase, headline, tone) for the caller's title
   * and announcements. Options: `sample` labels it as a sample and drops the "Updated" line;
   * `heading` is the route heading level (1 on /f/, 3 on the home page); `now` defaults to the clock.
   */
  function renderShareCard(container, f, { sample = false, heading = 1, now = Date.now() } = {}) {
    const m = model(f, now);
    const h = Math.min(6, Math.max(1, heading | 0));
    const route = `${f.origin.city || f.origin.code || "—"} to ${f.destination.city || f.destination.code || "—"}`;
    const who = f.ownerFirstName ? `${esc(f.ownerFirstName)} is sharing ${esc(flightNo(f.flightNumber))}` : `Shared flight ${esc(flightNo(f.flightNumber))}`;
    const value = m.value ? ` <span class="value">${esc(m.value)}</span>` : "";
    const updated = sample ? "Sample data — not a real flight."
      : `${!f.live ? "Live updates are off for this flight — showing the schedule. " : ""}${f.updatedAt ? `Updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d(f.updatedAt))}` : ""}`;
    container.innerHTML = `<article class="card tone-${m.tone}${sample ? " sample" : ""}"${sample ? ' aria-label="Sample of a shared flight"' : ""}>
      ${sample ? '<p class="sample-label" aria-hidden="true">Sample flight</p>' : ""}
      <p class="context">${who}</p>
      <h${h} class="route">${esc(route)}</h${h}>
      <p class="phase">${esc(m.phase)}</p>
      <p class="headline" aria-label="${esc(spoken(m.lead + (m.value ? " " + m.value : "")))}">${esc(m.lead)}${value}</p>
      ${m.line ? `<p class="status" aria-label="${esc(spoken(m.line))}">${esc(m.line)}</p>` : ""}
      ${track(f, m)}
      <section class="times" aria-label="Times">${leg(f, "dep")}${leg(f, "arr")}</section>
      ${f.baggageBelt ? `<p class="belt">Baggage belt <b>${esc(f.baggageBelt)}</b></p>` : ""}
    </article>
    <p class="updated">${esc(updated)}</p>`;
    // Through the DOM, not a style attribute, so the strict CSP needs no 'unsafe-inline'.
    container.querySelectorAll(".plane[data-left]").forEach((el) => { el.style.left = `${el.dataset.left}%`; });
    return m;
  }

  /** "BA 117 · Lands in 4h 25m · Roamfly" — the tab title for a real share. */
  const cardTitle = (f, m) => `${flightNo(f.flightNumber)} · ${m.lead}${m.value ? " " + m.value : ""} · Roamfly`;

  window.RoamflyCard = { renderShareCard, cardTitle, esc, spoken };
})();
