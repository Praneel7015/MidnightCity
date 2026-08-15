import { PRESETS, requestLivery } from "../api.js";

export function bindGarage({ onLivery, onRace, onGarage }) {
  const nameEl = document.getElementById("livery-name");
  const tagEl = document.getElementById("livery-tag");
  const statusEl = document.getElementById("livery-status");
  const spoilerEl = document.getElementById("opt-spoiler");
  const headlightsEl = document.getElementById("opt-headlights");

  // Custom color controls
  const bodyColorEl = document.getElementById("opt-body-color");
  const lowerColorEl = document.getElementById("opt-lower-color");
  const stripeOnEl = document.getElementById("opt-stripe-on");
  const stripeColorEl = document.getElementById("opt-stripe-color");
  const glowColorEl = document.getElementById("opt-glow-color");
  const rimColorEl = document.getElementById("opt-rim-color");
  const rimFinishEl = document.getElementById("opt-rim-finish");

  let current = { ...PRESETS[1] };

  function syncControls(livery) {
    if (bodyColorEl) bodyColorEl.value = livery.bodyHex || "#14c8d4";
    if (lowerColorEl) lowerColorEl.value = livery.lowerHex || "#111118";
    if (stripeOnEl) stripeOnEl.checked = !!livery.stripeHex;
    if (stripeColorEl) stripeColorEl.value = livery.stripeHex || "#ffffff";
    if (glowColorEl) glowColorEl.value = livery.glowHex || "#3df0ff";
    if (rimColorEl) rimColorEl.value = livery.rimHex || "#f2ffff";
    if (rimFinishEl) rimFinishEl.value = livery.rimFinish || "chrome";
  }

  function push() {
    current.spoiler = spoilerEl ? spoilerEl.checked : true;
    current.headlights = headlightsEl ? headlightsEl.checked : true;
    // Merge any live custom-control overrides
    if (bodyColorEl) current.bodyHex = bodyColorEl.value;
    if (lowerColorEl) current.lowerHex = lowerColorEl.value;
    if (stripeOnEl) current.stripeHex = stripeOnEl.checked ? (stripeColorEl ? stripeColorEl.value : "#ffffff") : null;
    if (glowColorEl) current.glowHex = glowColorEl.value;
    if (rimColorEl) current.rimHex = rimColorEl.value;
    if (rimFinishEl) current.rimFinish = rimFinishEl.value;
    onLivery(current);
    if (nameEl) nameEl.textContent = current.name || "Custom";
    if (tagEl) tagEl.textContent = current.tagline || "";
  }

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.preset);
      current = { ...PRESETS[i] };
      syncControls(current);
      push();
    });
  });

  // Live custom color/option listeners — update immediately on change
  [bodyColorEl, lowerColorEl, stripeColorEl, glowColorEl, rimColorEl].forEach((el) => {
    el?.addEventListener("input", () => {
      current.name = "Custom";
      current.tagline = "";
      push();
    });
  });

  stripeOnEl?.addEventListener("change", () => {
    current.name = "Custom";
    current.tagline = "";
    push();
  });

  rimFinishEl?.addEventListener("change", () => {
    current.name = "Custom";
    current.tagline = "";
    push();
  });

  spoilerEl?.addEventListener("change", push);
  headlightsEl?.addEventListener("change", push);

  document.getElementById("btn-ai")?.addEventListener("click", async () => {
    if (statusEl) statusEl.textContent = "Asking Nova for a paint job\u2026";
    const livery = await requestLivery();
    current = { ...current, ...livery };
    syncControls(current);
    push();
    if (statusEl) {
      statusEl.textContent =
        livery.source === "bedrock"
          ? "Bedrock Nova mixed this livery."
          : "Offline preset \u2014 start the API or deploy for live Nova.";
    }
  });

  document.getElementById("btn-race")?.addEventListener("click", () => {
    push();
    onRace();
  });

  document.getElementById("btn-garage")?.addEventListener("click", () => {
    document.body.dataset.mode = "garage";
    onGarage?.();
  });

  syncControls(current);
  push();
}
