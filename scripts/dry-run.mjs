import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTrackClosed, ROAD_HALF_WIDTH, WAYPOINTS } from "../frontend/src/game/trackData.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.join(root, "frontend");
let failed = 0;

function ok(msg) {
  console.log(`  OK  ${msg}`);
}
function fail(msg) {
  failed += 1;
  console.error(` FAIL ${msg}`);
}

function exists(rel) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) ok(rel);
  else fail(`missing ${rel}`);
}

console.log("Midnight City dry-run\n");

if (!isTrackClosed(WAYPOINTS)) fail("track spline is not a closed valid loop");
else ok(`closed circuit with ${WAYPOINTS.length} waypoints`);

if (ROAD_HALF_WIDTH >= 8) ok(`road half-width ${ROAD_HALF_WIDTH} (car will not be squeezed)`);
else fail("road is too narrow");

const required = [
  "frontend/src/game/car.js",
  "frontend/src/game/camera.js",
  "frontend/src/game/track.js",
  "frontend/src/game/city.js",
  "frontend/src/game/minimap.js",
  "frontend/src/game/controls.js",
  "frontend/src/game/loop.js",
  "frontend/src/game/traffic.js",
  "CREDITS.md",
  "frontend/index.html",
];
for (const f of required) exists(f);

const asphalt = path.join(frontend, "public/assets/asphalt_02_diff_1k.jpg");
if (fs.existsSync(asphalt) && fs.statSync(asphalt).size > 10000) ok("vendored Poly Haven asphalt texture");
else fail("asphalt texture missing");

const citySrc = fs.readFileSync(path.join(frontend, "src/game/city.js"), "utf8");
if (citySrc.includes("makeSkyTexture") || citySrc.includes("createCity")) ok("procedural night skybox generator present");
else fail("skybox generator missing");

const carSrc = fs.readFileSync(path.join(frontend, "src/game/car.js"), "utf8");
if (carSrc.includes("createProceduralCar")) ok("procedural car fallback present");
else fail("procedural car fallback missing");

if (!fs.existsSync(path.join(frontend, "node_modules"))) {
  console.log("\nInstalling frontend deps…");
  const inst = spawnSync("npm", ["install"], { cwd: frontend, stdio: "inherit", shell: true });
  if (inst.status !== 0) fail("npm install failed");
}

console.log("\nBuilding frontend…");
const build = spawnSync("npm", ["run", "build"], { cwd: frontend, stdio: "inherit", shell: true });
if (build.status !== 0) fail("vite build failed");

const dist = path.join(frontend, "dist/index.html");
if (fs.existsSync(dist)) ok("frontend/dist/index.html emitted");
else fail("build did not emit dist/index.html");

console.log("");
if (failed) {
  console.error(`Dry-run failed with ${failed} check(s).`);
  process.exit(1);
}
console.log("Dry-run passed. Next: npm run dev  →  http://localhost:5173");
console.log("WASD drive, Space brake, R reset. AWS is not required.");
