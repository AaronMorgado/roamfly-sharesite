"use strict";
/* Home page: the sample flight (re-drawn every 30 s so the countdown and plane move) and the share row. */
(() => {
  const SITE_URL = "https://roamfly.app/";
  const slot = document.getElementById("sample");
  const flight = window.RoamflySample.sampleFlight();
  const draw = () => { try { window.RoamflyCard.renderShareCard(slot, flight, { sample: true, heading: 3 }); } catch { /* keep the static fallback */ } };
  draw();
  setInterval(draw, 30 * 1000);

  window.RoamflyShare.renderShareButtons(document.getElementById("share-buttons"), {
    url: SITE_URL, text: "Track every flight in one place with Roamfly", title: "Roamfly",
  });
})();
