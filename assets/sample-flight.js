"use strict";
/*
 * The home page sample: a fictional flight (RF 204, Lisbon to New York) in exactly the shape the
 * shared-flight function returns. Times come from the visitor's clock when the page loads — left the gate
 * 3h 10m ago, lands in about 2h 50m — and the page re-renders so the countdown and plane move.
 * Never a network call, never a real person's flight.
 */
(() => {
  const MIN = 60 * 1000;
  function sampleFlight(now = Date.now()) {
    const at = (minutes) => new Date(now + minutes * MIN).toISOString();
    return {
      flightNumber: "RF204", airlineCode: "RF", status: "in_air", delayMinutes: 0, live: true, ownerFirstName: "Alex",
      origin: { code: "LIS", city: "Lisbon", timeZone: "Europe/Lisbon" },
      destination: { code: "JFK", city: "New York", timeZone: "America/New_York" },
      times: {
        scheduledDeparture: at(-190), estimatedDeparture: at(-190), actualDeparture: at(-190),
        takeoffScheduled: at(-175), takeoffEstimated: at(-175), takeoffActual: at(-175),
        landingScheduled: at(170), landingEstimated: at(170), landingActual: null,
        scheduledArrival: at(180), estimatedArrival: at(180), actualArrival: null,
      },
      gate: "14", terminal: "1", arrivalGate: "B22", arrivalTerminal: "4", baggageBelt: null,
      updatedAt: at(0),
    };
  }
  window.RoamflySample = { sampleFlight };
})();
