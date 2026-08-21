import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const REGION = process.env.AWS_REGION || "ap-south-1";
const bedrock = new BedrockRuntimeClient({ region: REGION });
const dynamo  = new DynamoDBClient({ region: REGION });

const MODEL_ID    = process.env.BEDROCK_MODEL_ID || "apac.amazon.nova-micro-v1:0";
const TABLE_NAME  = process.env.AGENT_TABLE      || "midnight-city-agent";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(text) {
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON in response");
  return JSON.parse(text.slice(start, end + 1));
}

function hex(v, fallback) {
  return typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v)
    ? v.startsWith("#") ? v : `#${v}`
    : fallback;
}

async function converseText(system, user, maxTokens = 220) {
  const res = await bedrock.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: system }],
    messages: [{ role: "user", content: [{ text: user }] }],
    inferenceConfig: { maxTokens, temperature: 0.9 },
  }));
  return (res.output?.message?.content ?? [])
    .map((p) => p.text || "")
    .join("")
    .trim();
}

// ── Livery generation ────────────────────────────────────────────────────────

async function generateDailyLivery(dateLabel) {
  const text = await converseText(
    "You are the Midnight City garage AI. Every night you design one original car livery. Return JSON only, no markdown.",
    `Today is ${dateLabel}. Design tonight's featured car livery.
Return ONLY compact JSON with keys:
  name       (2-3 words, evocative)
  tagline    (one cinematic sentence, ≤18 words)
  bodyHex    (#RRGGBB)
  rimHex     (#RRGGBB)
  glowHex    (#RRGGBB, underglow neon)
  spoiler    (boolean)
  headlights (boolean)
Make it vivid and night-city appropriate. No markdown.`
  );
  const raw = extractJson(text);
  return {
    name:      String(raw.name      || "Neon Drift").slice(0, 40),
    tagline:   String(raw.tagline   || "Born under the overpass.").slice(0, 120),
    bodyHex:   hex(raw.bodyHex,  "#ff2d6a"),
    rimHex:    hex(raw.rimHex,   "#d8dbe8"),
    glowHex:   hex(raw.glowHex,  "#3df0ff"),
    spoiler:   raw.spoiler   !== false,
    headlights:raw.headlights !== false,
    source:    "agent",
  };
}

// ── Track mood generation ────────────────────────────────────────────────────

// Weather vibes rotate on a weekly cycle so each day feels different without
// needing a live weather API (keeping this fully free-tier / offline-safe).
const WEATHER_CYCLE = [
  "Clear night, full moon, dry asphalt",
  "Light rain, wet roads, puddles catching neon",
  "Heavy fog rolling in from the harbour",
  "Thunderstorm, lightning on the skyline",
  "Hot still night, heat shimmer off tarmac",
  "Cold clear night, frost on the kerbs",
  "Overcast, orange cloud-glow from the city",
];

async function generateTrackMood(dateLabel, weatherVibe) {
  const text = await converseText(
    "You are the Midnight City atmosphere engine. Return JSON only, no markdown.",
    `Conditions: ${weatherVibe}. Date: ${dateLabel}.
Return ONLY compact JSON with keys:
  condition  (2-4 word weather label for the HUD)
  fogDensity (number 0.0–1.0, higher = thicker fog)
  skyHex     (dominant sky color #RRGGBB, dark/moody)
  ambientHex (ambient light tint #RRGGBB)
  tagline    (one atmospheric sentence ≤16 words)
No markdown.`
  );
  const raw = extractJson(text);
  return {
    condition:  String(raw.condition  || weatherVibe).slice(0, 32),
    fogDensity: Math.max(0, Math.min(1, Number(raw.fogDensity) || 0.18)),
    skyHex:     hex(raw.skyHex,     "#0d0820"),
    ambientHex: hex(raw.ambientHex, "#1a1030"),
    tagline:    String(raw.tagline   || "").slice(0, 100),
    source:     "agent",
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function handler(event = {}) {
  const now       = new Date();
  const dateLabel = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" });
  const dayIndex  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
                      .indexOf(dayOfWeek);
  const weatherVibe = WEATHER_CYCLE[dayIndex >= 0 ? dayIndex : 0];

  console.log(`[agent] running for ${dateLabel} — weather vibe: ${weatherVibe}`);

  const [livery, mood] = await Promise.all([
    generateDailyLivery(dateLabel),
    generateTrackMood(dateLabel, weatherVibe),
  ]);

  const item = {
    pk:          { S: "today" },
    dateLabel:   { S: dateLabel },
    generatedAt: { S: now.toISOString() },
    livery:      { S: JSON.stringify(livery) },
    mood:        { S: JSON.stringify(mood) },
  };

  await dynamo.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }));

  console.log(`[agent] wrote today's livery "${livery.name}" and mood "${mood.condition}" to DynamoDB`);

  return { statusCode: 200, body: JSON.stringify({ livery, mood, dateLabel }) };
}
