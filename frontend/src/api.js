const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

export const PRESETS = [
  {
    name: "Voltage Violet",
    tagline: "A neon bruise on the midnight asphalt.",
    bodyHex: "#7a1fff",
    rimHex: "#e8deff",
    glowHex: "#b14bff",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Harbor Cyan",
    tagline: "Wet streets. Cold light. Keep the revs up.",
    bodyHex: "#14c8d4",
    rimHex: "#f2ffff",
    glowHex: "#3df0ff",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Ember",
    tagline: "Sunset trapped under clearcoat.",
    bodyHex: "#ff3b1f",
    rimHex: "#ffd7a8",
    glowHex: "#ff7a18",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Ghost Pearl",
    tagline: "Almost white. Almost legal.",
    bodyHex: "#e8e4f0",
    rimHex: "#3df0ff",
    glowHex: "#ff2d95",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Midnight Jade",
    tagline: "Green that only shows up under streetlamps.",
    bodyHex: "#0b6b4f",
    rimHex: "#d4ffe8",
    glowHex: "#3dff9a",
    spoiler: false,
    headlights: true,
    source: "preset",
  },
];

async function postJson(path, payload) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function requestLivery() {
  try {
    const data = await postJson("/livery", { vibe: "midnight city street race" });
    if (data && data.bodyHex) return { ...data, source: data.source || "bedrock" };
  } catch {
    /* fall through */
  }
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}

export async function requestCommentary({ kind, kph, lap, livery }) {
  try {
    const data = await postJson("/commentary", { kind, kph, lap, livery });
    if (data?.line) return data;
  } catch {
    /* fall through */
  }
  const lines = {
    start: "Engines hot. Midnight City is live.",
    speed: "That's a heat run. Keep it planted.",
    lap: "Lap in the books. Do it again, cleaner.",
    reset: "Reset. The line is still yours.",
  };
  return { line: lines[kind] || lines.start, kind, source: "fallback" };
}
