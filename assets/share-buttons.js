"use strict";
/*
 * Share row: plain links to each network's own share address — no vendor scripts, nothing loaded until a
 * visitor clicks. Addresses checked 2026-11-13 (X docs: x.com/intent/tweet; Telegram docs: t.me/share/url).
 * Facebook and LinkedIn ignore passed text and build the post from the page's preview tags.
 */
(() => {
  const NETWORKS = [
    ["X", ({ url, text }) => `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`],
    ["Facebook", ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
    ["WhatsApp", ({ url, text }) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`],
    ["Telegram", ({ url, text }) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`],
    ["LinkedIn", ({ url }) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`],
  ];
  // Generic glyphs drawn for this site (no vendor logos): share arrow, link.
  const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
  const ICON_LINK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (html) e.innerHTML = html;
    return e;
  }

  async function copy(url, button, status) {
    let done = false;
    try { await navigator.clipboard.writeText(url); done = true; } catch { /* fall through */ }
    if (!done) { // Older browsers or no permission: show the link selected so it can be copied by hand.
      let field = button.parentElement.parentElement.querySelector(".copy-fallback");
      if (!field) {
        field = el("input", { class: "copy-fallback", readonly: "", "aria-label": "Link to copy" });
        button.parentElement.after(field);
      }
      field.value = url;
      field.focus(); field.select();
      try { done = document.execCommand("copy"); } catch { done = false; }
      if (!done) { status.textContent = "Select the link and copy it"; return; }
    }
    const label = button.querySelector(".text");
    button.classList.add("copied"); label.textContent = "Copied"; status.textContent = "Link copied";
    setTimeout(() => { button.classList.remove("copied"); label.textContent = "Copy link"; status.textContent = ""; }, 2000);
  }

  /** Fills `container` with the share row for `url` (title is used by the system share sheet). */
  function renderShareButtons(container, { url, text, title = "Roamfly" }) {
    const row = el("div", { class: "share-row" });
    const status = el("p", { class: "sr-only", "aria-live": "polite" });
    if (typeof navigator.share === "function") {
      const b = el("button", { type: "button", class: "primary" }, `${ICON_SHARE}<span>Share</span>`);
      b.addEventListener("click", () => navigator.share({ title, text, url }).catch(() => {}));
      row.append(b);
    }
    const c = el("button", { type: "button" }, `${ICON_LINK}<span class="text">Copy link</span>`);
    c.addEventListener("click", () => copy(url, c, status));
    row.append(c);
    for (const [name, href] of NETWORKS) {
      const a = el("a", { href: href({ url, text }), target: "_blank", rel: "noopener noreferrer" });
      a.textContent = name;
      a.append(el("span", { class: "sr-only" }, " (opens in a new tab)"));
      row.append(a);
    }
    container.replaceChildren(row, status);
  }

  window.RoamflyShare = { renderShareButtons };
})();
