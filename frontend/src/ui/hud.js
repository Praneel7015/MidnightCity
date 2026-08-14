import { MAX_SPEED } from "../game/car.js";

function fmt(t) {
  if (t == null) return "--:--.--";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

export function bindHud() {
  const speed = document.getElementById("hud-speed");
  const lap = document.getElementById("hud-lap");
  const time = document.getElementById("hud-time");
  const best = document.getElementById("hud-best");
  const bar = document.getElementById("speed-fill");

  return {
    update(v) {
      const kph = Math.abs(v.speed) * 9.2;
      if (speed) speed.textContent = String(Math.round(kph)).padStart(3, "0");
      if (lap) lap.textContent = String(v.lap);
      if (time) time.textContent = fmt(v.lapTime);
      if (best) best.textContent = fmt(v.bestLap);
      if (bar) bar.style.width = `${Math.min(100, (Math.abs(v.speed) / MAX_SPEED) * 100)}%`;
    },
  };
}
