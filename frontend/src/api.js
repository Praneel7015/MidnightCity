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

export async function requestLivery() {
  const bases = [import.meta.env.VITE_API_URL, "http://localhost:3001"].filter(Boolean);
  for (const base of bases) {
    try {
      const r = await fetch(`${String(base).replace(/\/$/, "")}/livery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibe: "midnight city street race" }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      if (data && data.bodyHex) return { ...data, source: data.source || "bedrock" };
    } catch {
      /* try next / fall through */
    }
  }
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}
