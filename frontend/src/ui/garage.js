import { PRESETS, requestLivery } from "../api.js";

export function bindGarage({ onLivery, onRace, onGarage }) {
  const nameEl = document.getElementById("livery-name");
  const tagEl = document.getElementById("livery-tag");
  const statusEl = document.getElementById("livery-status");
  const spoiler = document.getElementById("opt-spoiler");
  const headlights = document.getElementById("opt-headlights");

  let current = { ...PRESETS[1] };

  function push() {
    current.spoiler = spoiler ? spoiler.checked : true;
    current.headlights = headlights ? headlights.checked : true;
    onLivery(current);
    if (nameEl) nameEl.textContent = current.name;
    if (tagEl) tagEl.textContent = current.tagline;
  }

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.preset);
      current = { ...PRESETS[i] };
      push();
    });
  });

  spoiler?.addEventListener("change", push);
  headlights?.addEventListener("change", push);

  document.getElementById("btn-ai")?.addEventListener("click", async () => {
    if (statusEl) statusEl.textContent = "Asking Nova for a paint job…";
    const livery = await requestLivery();
    current = { ...current, ...livery };
    push();
    if (statusEl) {
      statusEl.textContent =
        livery.source === "bedrock"
          ? "Bedrock Nova mixed this livery."
          : "Offline preset — start the API or deploy for live Nova.";
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

  push();
}
