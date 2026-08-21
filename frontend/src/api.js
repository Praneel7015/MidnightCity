const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

export const PRESETS = [
  {
    name: "Voltage Violet",
    tagline: "A neon bruise on the midnight asphalt.",
    bodyHex: "#7a1fff",
    lowerHex: "#2a0a55",
    stripeHex: "#e0c8ff",
    rimHex: "#e8deff",
    rimFinish: "chrome",
    glowHex: "#b14bff",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Harbor Cyan",
    tagline: "Wet streets. Cold light. Keep the revs up.",
    bodyHex: "#14c8d4",
    lowerHex: "#093845",
    stripeHex: null,
    rimHex: "#f2ffff",
    rimFinish: "chrome",
    glowHex: "#3df0ff",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Ember",
    tagline: "Sunset trapped under clearcoat.",
    bodyHex: "#ff3b1f",
    lowerHex: "#1a0800",
    stripeHex: "#ffcc44",
    rimHex: "#ffd7a8",
    rimFinish: "color",
    glowHex: "#ff7a18",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Ghost Pearl",
    tagline: "Almost white. Almost legal.",
    bodyHex: "#e8e4f0",
    lowerHex: "#5a547a",
    stripeHex: "#3df0ff",
    rimHex: "#3df0ff",
    rimFinish: "color",
    glowHex: "#ff2d95",
    spoiler: true,
    headlights: true,
    source: "preset",
  },
  {
    name: "Midnight Jade",
    tagline: "Green that only shows up under streetlamps.",
    bodyHex: "#0b6b4f",
    lowerHex: "#041a13",
    stripeHex: null,
    rimHex: "#d4ffe8",
    rimFinish: "matte",
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

export async function requestToday() {
  try {
    const r = await fetch(`${API_URL}/today`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data?.livery?.bodyHex) return data;
  } catch {
    /* fall through */
  }
  return null;
}

export async function requestCommentary({ kind, kph, lap, livery }) {
  try {
    const data = await postJson("/commentary", { kind, kph, lap, livery });
    if (data?.line) return data;
  } catch {
    /* fall through */
  }
  const pools = {
    start: [
      "Engines hot. Midnight City is live.",
      "Lights out. The circuit is yours.",
      "Drop in. The night doesn't wait.",
      "Green light. Let's see what you've got.",
      "Race is on. Keep it clean.",
    ],
    speed: [
      "That's a heat run. Keep it planted.",
      "You're flying. Don't lift now.",
      "Full send. The city's a blur.",
      "That line is on fire.",
      "Top of the rev range. Beautiful.",
    ],
    lap: [
      "Lap in the books. Do it again, cleaner.",
      "Another one. You're getting faster.",
      "Lap complete. The gap is closing.",
      "That's the rhythm. Stay with it.",
      "Clean lap. Keep that pace.",
    ],
    reset: [
      "Reset. The line is still yours.",
      "Back on track. Don't waste it.",
      "Reset. Hit that apex this time.",
      "You're back. Make it count.",
      "Second chance. Use it.",
    ],
    overtake: [
      "You passed one. Keep hunting.",
      "Clear. Who's next?",
      "That's a move. Stay aggressive.",
      "One down. Eyes forward.",
      "Beautiful pass. Push on.",
    ],
    passed: [
      "They got you. Take it back.",
      "You've been overtaken. Respond.",
      "Don't let them gap you.",
      "Hit back. Next corner.",
      "They're gone. Or are they?",
    ],
  };
  const pool = pools[kind] || pools.start;
  // Rotate through the pool to avoid repeating
  requestCommentary._idx = requestCommentary._idx || {};
  const i = (requestCommentary._idx[kind] || 0) % pool.length;
  requestCommentary._idx[kind] = i + 1;
  return { line: pool[i], kind, source: "fallback" };
}
