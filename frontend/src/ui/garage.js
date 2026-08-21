import { PRESETS, requestLivery, requestToday } from "../api.js";

export function bindGarage({ onLivery, onRace, onGarage, onTodayMood }) {
  const nameEl      = document.getElementById("livery-name");
  const tagEl       = document.getElementById("livery-tag");
  const statusEl    = document.getElementById("livery-status");
  const tonightBtn  = document.getElementById("btn-tonight");

  const bodyColorEl = document.getElementById("opt-body-color");
  const glowColorEl = document.getElementById("opt-glow-color");
  const rimColorEl  = document.getElementById("opt-rim-color");

  let current = { ...PRESETS[1] };

  function syncControls(livery) {
    if (bodyColorEl) bodyColorEl.value = livery.bodyHex || "#14c8d4";
    if (glowColorEl) glowColorEl.value = livery.glowHex || "#3df0ff";
    if (rimColorEl)  rimColorEl.value  = livery.rimHex  || "#f2ffff";
  }

  function push() {
    if (bodyColorEl) current.bodyHex = bodyColorEl.value;
    if (glowColorEl) current.glowHex = glowColorEl.value;
    if (rimColorEl)  current.rimHex  = rimColorEl.value;
    onLivery(current);
    if (nameEl) nameEl.textContent = current.name || "Custom";
    if (tagEl)  tagEl.textContent  = current.tagline || "";
  }

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      current = { ...PRESETS[Number(btn.dataset.preset)] };
      syncControls(current);
      push();
    });
  });

  [bodyColorEl, glowColorEl, rimColorEl].forEach((el) => {
    el?.addEventListener("input", () => {
      current.name    = "Custom";
      current.tagline = "";
      push();
    });
  });

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
          : "Offline preset \u2014 deploy for live Nova.";
    }
  });

  // Tonight's Build — load agent-generated livery from DynamoDB via /today
  tonightBtn?.addEventListener("click", async () => {
    if (statusEl) statusEl.textContent = "Loading tonight\u2019s build\u2026";
    const data = await requestToday();
    if (data?.livery) {
      current = { ...current, ...data.livery };
      syncControls(current);
      push();
      if (statusEl) {
        const cond = data.mood?.condition ? ` \u00b7 ${data.mood.condition}` : "";
        statusEl.textContent = `Tonight\u2019s build by the agent${cond}`;
      }
      if (data.mood) onTodayMood?.(data.mood);
    } else {
      if (statusEl) statusEl.textContent = "No agent build yet \u2014 check back at midnight.";
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

  // Fetch tonight's build silently on load and reveal the button if available
  requestToday().then((data) => {
    if (!data?.livery) return;
    if (tonightBtn) tonightBtn.hidden = false;
    if (statusEl && data.mood?.condition) {
      statusEl.textContent = `Tonight\u2019s conditions: ${data.mood.condition}`;
    }
    if (data.mood) onTodayMood?.(data.mood);
  }).catch(() => {});

  syncControls(current);
  push();
}
