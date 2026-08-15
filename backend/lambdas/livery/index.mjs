import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
const bedrock = new BedrockRuntimeClient({ region: REGION });
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "apac.amazon.nova-micro-v1:0";

const LIVERY_FALLBACK = [
  {
    name: "Nova Nightfall",
    tagline: "The model was busy. The streets were not.",
    bodyHex: "#5b2dff",
    rimHex: "#f0e7ff",
    glowHex: "#ff2d95",
    spoiler: true,
    headlights: true,
  },
  {
    name: "Circuit Cinder",
    tagline: "A paint job that looks like it remembers a crash.",
    bodyHex: "#c81e1e",
    rimHex: "#ffd0a8",
    glowHex: "#ff7a18",
    spoiler: true,
    headlights: true,
  },
];

const COMMENTARY_FALLBACK = {
  start: ["Engines hot. Midnight City is live. Drive it like you stole the night."],
  speed: ["That's a heat run. Keep it planted."],
  lap: ["Lap in the books. Do it again, cleaner."],
  reset: ["Reset. The line is still yours."],
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return { statusCode, headers: cors, body: JSON.stringify(body) };
}

function parseBody(event) {
  if (!event?.body) return {};
  if (typeof event.body === "object") return event.body;
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function pathOf(event) {
  return (
    event.requestContext?.http?.path ||
    event.rawPath ||
    event.path ||
    ""
  ).toLowerCase();
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

function hex(v, d) {
  return typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v) ? (v.startsWith("#") ? v : `#${v}`) : d;
}

function normalizeLivery(raw) {
  return {
    name: String(raw.name || "Unnamed Heat").slice(0, 40),
    tagline: String(raw.tagline || "Born under sodium lamps.").slice(0, 120),
    bodyHex: hex(raw.bodyHex, "#ff2d6a"),
    rimHex: hex(raw.rimHex, "#d8dbe8"),
    glowHex: hex(raw.glowHex, "#3df0ff"),
    spoiler: raw.spoiler !== false,
    headlights: raw.headlights !== false,
    source: "bedrock",
  };
}

async function converseText(system, user, maxTokens = 180) {
  try {
    const response = await bedrock.send(
      new ConverseCommand({
        modelId: BEDROCK_MODEL_ID,
        system: [{ text: system }],
        messages: [{ role: "user", content: [{ text: user }] }],
        inferenceConfig: { maxTokens, temperature: 0.85 },
      })
    );
    const parts = response.output?.message?.content ?? [];
    const text = parts.map((p) => (p.text ? p.text : "")).join("").trim();
    if (text) return text;
  } catch (err) {
    console.warn("Converse failed, trying InvokeModel", err?.message || err);
  }

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      messages: [{ role: "user", content: [{ text: `${system}\n\n${user}` }] }],
      inferenceConfig: { maxTokens, temperature: 0.85 },
    }),
  });
  const response = await bedrock.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));
  return (
    decoded?.output?.message?.content?.map((c) => c.text).join("\n") ??
    decoded?.completion ??
    ""
  ).trim();
}

async function generateLivery() {
  const text = await converseText(
    "You design original car liveries for Midnight City, a night street-racing game. Return JSON only.",
    `Return ONLY compact JSON with keys: name (2-3 words), tagline (one short cinematic sentence), bodyHex, rimHex, glowHex (all #RRGGBB), spoiler (boolean), headlights (boolean).
Make it vivid. No markdown.`
  );
  return normalizeLivery(extractJson(text));
}

async function generateCommentary(payload) {
  const kind = String(payload.kind || "start");
  const kph = Math.round(Number(payload.kph) || 0);
  const lap = Number(payload.lap) || 0;
  const livery = String(payload.livery || "the coupe");
  const text = await converseText(
    "You are the Midnight City race announcer. One sentence. No quotes. No emoji. Sound like a late-night street-race radio.",
    `Event: ${kind}. Car: ${livery}. Speed: ${kph} kph. Lap: ${lap}.
Write one spoken line, max 16 words.`
  );
  const line = text.replace(/^["']|["']$/g, "").split("\n")[0].trim();
  if (!line) throw new Error("empty commentary");
  return { line, kind, source: "bedrock" };
}

export async function handler(event = {}) {
  const method = event.requestContext?.http?.method || event.httpMethod || "POST";
  const path = pathOf(event);
  if (method === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (method === "GET") return json(200, { ok: true, service: "midnight-city", region: REGION, model: BEDROCK_MODEL_ID });

  const body = parseBody(event);

  if (path.includes("commentary")) {
    try {
      return json(200, await generateCommentary(body));
    } catch (err) {
      console.error("commentary fallback", err?.message || err);
      const kind = String(body.kind || "start");
      const pool = COMMENTARY_FALLBACK[kind] || COMMENTARY_FALLBACK.start;
      return json(200, { line: pool[Math.floor(Math.random() * pool.length)], kind, source: "fallback" });
    }
  }

  try {
    return json(200, await generateLivery());
  } catch (err) {
    console.error("livery fallback", err?.message || err);
    const fallback = LIVERY_FALLBACK[Math.floor(Math.random() * LIVERY_FALLBACK.length)];
    return json(200, { ...fallback, source: "fallback" });
  }
}
