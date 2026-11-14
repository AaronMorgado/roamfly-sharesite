"use strict";
/*
 * Site-wide: the download button. Set APP_STORE_URL once the app is live (https://apps.apple.com/app/id…)
 * and every [data-download] on every page becomes the App Store button. Empty = an honest
 * "Coming soon" label that is not a link. Do not use Apple's badge artwork until the app is live and
 * Apple's badge guidelines have been checked.
 */
(() => {
  const APP_STORE_URL = "";
  const ok = /^https:\/\/apps\.apple\.com\//.test(APP_STORE_URL);
  document.querySelectorAll("[data-download]").forEach((slot) => {
    if (!ok) {
      slot.innerHTML = '<span class="soon">Coming soon to the App Store</span>';
      return;
    }
    const a = document.createElement("a");
    a.className = "button";
    a.href = APP_STORE_URL;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Download on the App Store";
    slot.replaceChildren(a);
  });
})();
