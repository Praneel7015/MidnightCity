import { requestCommentary } from "../api.js";

let bgm;
let unlocked = false;
let muted = false;
let lastSpeak = 0;
const lastAnnounce = {};

function banner(text) {
  const el = document.getElementById("callout");
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(banner._t);
  banner._t = setTimeout(() => {
    el.hidden = true;
  }, 4200);
}

export function unlockAudio() {
  if (unlocked) {
    if (bgm && bgm.paused && !muted) bgm.play().catch(() => {});
    return;
  }
  unlocked = true;
  if (!bgm) {
    bgm = new Audio("/assets/music/race.mp3");
    bgm.loop = true;
    bgm.volume = 0.38;
    bgm.preload = "auto";
  }
  if (!muted) {
    bgm.play().catch(() => {});
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}

export function setMuted(next) {
  muted = next;
  if (bgm) bgm.muted = muted;
  if (muted && window.speechSynthesis) window.speechSynthesis.cancel();
  if (!muted) unlockAudio();
  const btn = document.getElementById("btn-mute");
  if (btn) btn.textContent = muted ? "Sound off" : "Sound on";
}

export function toggleMute() {
  setMuted(!muted);
}

export function speak(text) {
  if (!text || muted) return;
  banner(text);
  if (!window.speechSynthesis) return;
  const now = performance.now();
  if (now - lastSpeak < 2500) return;
  lastSpeak = now;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.08;
  u.pitch = 0.92;
  u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const pick =
    voices.find((v) => /en-(US|GB|AU|IN)/i.test(v.lang) && /male|daniel|david|alex|google/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang));
  if (pick) u.voice = pick;
  window.speechSynthesis.speak(u);
}

export async function announce(kind, stats = {}) {
  const now = performance.now();
  const cooldown = kind === "start" ? 0 : kind === "lap" ? 4000 : 8000;
  if (lastAnnounce[kind] && now - lastAnnounce[kind] < cooldown) return;
  lastAnnounce[kind] = now;
  unlockAudio();
  const data = await requestCommentary({
    kind,
    kph: stats.kph || 0,
    lap: stats.lap || 0,
    livery: stats.livery || "Harbor Cyan",
    pos: stats.pos || null,
    total: stats.total || null,
    opponent: stats.opponent || null,
  });
  speak(data.line);
  return data;
}

export function bindMute() {
  document.getElementById("btn-mute")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMute();
  });
}
