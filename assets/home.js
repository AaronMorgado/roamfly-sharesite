"use strict";
/* Home page: the sample flight (re-drawn every 30 s so the countdown and plane move) and the share row. */
(() => {
  const SITE_URL = "https://roamfly.app/";
  const slot = document.getElementById("sample");
  let flight = null;
  try { flight = window.RoamflySample.sampleFlight(); } catch { /* drawn below as the picture */ }
  // If drawing ever fails, show the still picture of the sample (the same one shown with JavaScript off).
  const fallback = () => {
    const img = document.createElement("img");
    img.className = "sample-static"; img.src = "/assets/sample-card.png"; img.width = 1088; img.height = 1100;
    img.alt = "Sample of a shared flight: Alex is sharing RF 204, Lisbon to New York, in the air, lands in about 2 hours 50 minutes, on time.";
    slot.replaceChildren(img);
  };
  let failed = false;
  const draw = () => {
    if (failed) return;
    try { window.RoamflyCard.renderShareCard(slot, flight, { sample: true, heading: 3 }); } catch { failed = true; fallback(); }
  };
  draw();
  setInterval(draw, 30 * 1000);

  window.RoamflyShare.renderShareButtons(document.getElementById("share-buttons"), {
    url: SITE_URL, text: "Track every flight in one place with Roamfly", title: "Roamfly",
  });
})();
