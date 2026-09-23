(function () {
  "use strict";

  // Keep the public pages aligned with popup.js. Local payment regions use
  // Gank; everyone else is sent to Buy Me a Coffee.
  const GANK_URL = "https://ganknow.com/nextfeederlabs/tip";
  const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/nextfeederlabs";

  const GANK_LOCAL_PAYMENT_TIMEZONES = new Set([
    "Asia/Bangkok",
    "Asia/Ho_Chi_Minh",
    "Asia/Saigon",
    "Asia/Jakarta",
    "Asia/Pontianak",
    "Asia/Makassar",
    "Asia/Jayapura",
    "Asia/Manila",
    "Asia/Kuala_Lumpur",
    "Asia/Kuching",
    "Asia/Singapore",
    "Asia/Taipei",
  ]);

  const GANK_LOCAL_PAYMENT_LANGUAGES = ["th", "vi", "id", "fil", "tl", "ms"];

  function getDonationUrl() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone && GANK_LOCAL_PAYMENT_TIMEZONES.has(timezone)) return GANK_URL;

      const language = (navigator.language || "").toLowerCase();
      if (
        GANK_LOCAL_PAYMENT_LANGUAGES.some((prefix) => language.startsWith(prefix)) ||
        language.includes("-tw")
      ) {
        return GANK_URL;
      }
    } catch (_) {}

    return BUY_ME_A_COFFEE_URL;
  }

  function applyDonationLinks(root = document) {
    const url = getDonationUrl();
    const isGank = url === GANK_URL;

    root.querySelectorAll("[data-donation-link]").forEach((link) => {
      link.href = url;
      link.dataset.donationProvider = isGank ? "gank" : "buymeacoffee";

      const label = link.querySelector("[data-donation-label]");
      if (label) {
        label.textContent = isGank
          ? label.dataset.gankLabel || "GANK"
          : label.dataset.coffeeLabel || "BUY ME A COFFEE";
      }
    });
  }

  window.NextSonaDonation = { getDonationUrl, applyDonationLinks };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyDonationLinks(), { once: true });
  } else {
    applyDonationLinks();
  }
})();
