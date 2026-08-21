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

export async function requestCommentary({ kind, kph, lap, livery, pos, total, opponent }) {
  try {
    const data = await postJson("/commentary", { kind, kph, lap, livery, pos, total, opponent });
    if (data?.line) return data;
  } catch {
    /* fall through */
  }

  const p = pos || 1;
  const t = total || 10;
  const opp = opponent || "them";
  const kphStr = kph ? `${Math.round(kph)} km/h` : null;
  const lapStr = lap ? `Lap ${lap}` : null;

  const pools = {
    start: [
      `${livery || "Your ride"} is on the grid. Midnight City's all yours.`,
      "Lights out. The circuit is live.",
      "Drop in. The night doesn't care about second place.",
      "Green light — let's find out what this thing can do.",
      "Race is on. Twelve cars, one road. Go.",
    ],
    speed: kphStr ? [
      `${kphStr}. Don't let off now.`,
      `Running ${kphStr}. The city's a blur.`,
      `${kphStr} and climbing. Top of the range.`,
      `That's a heat run. ${kphStr} on the straight.`,
      `Full send at ${kphStr}. Beautiful.`,
    ] : [
      "You're flying. Don't lift.",
      "Top of the rev range.",
      "Full send. Beautiful.",
      "That line is on fire.",
      "Heat run. Keep it planted.",
    ],
    lap: lapStr ? [
      `${lapStr} done. P${p} of ${t}. Keep the pressure on.`,
      `${lapStr} in the books. You're sitting P${p}.`,
      `Clean lap — ${lapStr}. ${p === 1 ? "Lead is yours, defend it." : `${p - 1} car${p - 1 > 1 ? "s" : ""} ahead.`}`,
      `${lapStr} complete. ${p <= 3 ? "Podium territory." : "Hunt 'em down."}`,
      `Another lap. P${p} of ${t}. Stay with it.`,
    ] : [
      "Lap done. Keep that rhythm.",
      "Another one. You're getting faster.",
      "Lap complete. Stay focused.",
      "Clean lap. Hold the pace.",
      "The gap is closing. Push.",
    ],
    reset: [
      "Reset. The line is still yours.",
      "Back on track. Don't waste it.",
      "Reset. Hit that apex this time.",
      "You're back. Make it count.",
      "Second chance. Use it.",
    ],
    overtake: opponent ? [
      `${opp} is behind you. P${p} of ${t}. Keep going.`,
      `Past ${opp}! P${p} now. Eyes forward.`,
      `That's a move. ${opp} couldn't hold the line.`,
      `Clean pass on ${opp}. P${p} of ${t}.`,
      `${opp} in the mirror. Who's next?`,
    ] : [
      `P${p} of ${t}. Nice move — keep hunting.`,
      `You moved up. P${p}. Stay aggressive.`,
      "Clear. Who's next?",
      "That's a pass. Eyes forward.",
      "Beautiful move. Push on.",
    ],
    passed: opponent ? [
      `${opp} got you. You're P${p} now. Hit back.`,
      `${opp} made the move. Respond — next corner.`,
      `P${p} of ${t}. ${opp} found the gap. Close it.`,
      `Don't let ${opp} gap you. Stay with them.`,
      `${opp} is gone — or are they? P${p}. Go.`,
    ] : [
      `P${p} of ${t}. They got you. Take it back.`,
      "You've been overtaken. Respond.",
      "Don't let them gap you.",
      "Hit back. Next corner.",
      "They're ahead. For now.",
    ],
  };

  const pool = pools[kind] || pools.start;
  requestCommentary._idx = requestCommentary._idx || {};
  const i = (requestCommentary._idx[kind] || 0) % pool.length;
  requestCommentary._idx[kind] = i + 1;
  return { line: pool[i], kind, source: "fallback" };
}
