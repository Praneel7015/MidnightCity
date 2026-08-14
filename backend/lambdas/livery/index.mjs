import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({});
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "apac.amazon.nova-micro-v1:0";

const FALLBACK = [
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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return { statusCode, headers: cors, body: JSON.stringify(body) };
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

function normalize(raw) {
  const hex = (v, d) => (typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v) ? (v.startsWith("#") ? v : `#${v}`) : d);
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

async function generateLivery() {
  const prompt = `You design illegal-looking but original car liveries for a night street-racing game called Midnight City.
Return ONLY compact JSON with keys:
name (2-3 words), tagline (one short cinematic sentence), bodyHex, rimHex, glowHex (all #RRGGBB), spoiler (boolean), headlights (boolean).
Make it vivid and not generic red/blue. No markdown.`;

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 250, temperature: 0.9 },
    }),
  });

  const response = await bedrock.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));
  const text =
    decoded?.output?.message?.content?.map((c) => c.text).join("\n") ?? decoded?.completion ?? "";
  return normalize(extractJson(text));
}

export async function handler(event = {}) {
  const method = event.requestContext?.http?.method || event.httpMethod || "POST";
  if (method === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (method === "GET") return json(200, { ok: true, service: "midnight-city-livery" });

  try {
    const livery = await generateLivery();
    return json(200, livery);
  } catch (err) {
    console.error("livery fallback", err?.message || err);
    const fallback = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
    return json(200, { ...fallback, source: "fallback" });
  }
}
