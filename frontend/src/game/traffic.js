import * as THREE from "three";
import { PRESETS } from "../api.js";
import { applyLivery, createProceduralCar, createVehicle, MAX_SPEED, syncCarMesh } from "./car.js";

const NPC_PAINT = [
  ...PRESETS,
  {
    name: "Solar Flare",
    tagline: "Too loud for the tunnel.",
    bodyHex: "#ffb000",
    lowerHex: "#1a0c00",
    stripeHex: "#ff4400",
    rimHex: "#fff4d0",
    rimFinish: "chrome",
    glowHex: "#ff7a00",
    spoiler: true,
    headlights: true,
  },
  {
    name: "Police Ghost",
    tagline: "Blue lights, no badge.",
    bodyHex: "#1a2744",
    lowerHex: "#0a1020",
    stripeHex: null,
    rimHex: "#d8e8ff",
    rimFinish: "matte",
    glowHex: "#4d7cff",
    spoiler: false,
    headlights: true,
  },
  {
    name: "Hot Pink",
    tagline: "Stolen from a magazine ad.",
    bodyHex: "#ff2d95",
    lowerHex: "#44002a",
    stripeHex: "#ffffff",
    rimHex: "#ffffff",
    rimFinish: "color",
    glowHex: "#ff6ad5",
    spoiler: true,
    headlights: true,
  },
  {
    name: "Rust Rocket",
    tagline: "Primer and bad decisions.",
    bodyHex: "#8a3a22",
    lowerHex: "#2a0c06",
    stripeHex: null,
    rimHex: "#c4a882",
    rimFinish: "matte",
    glowHex: "#ff5a1f",
    spoiler: false,
    headlights: true,
  },
];

// Named racers — each NPC gets a permanent driver name shown in commentary
const RACER_NAMES = [
  "KAI", "REX", "NOVA", "ECHO", "VOSS",
  "PIKE", "ZARA", "DUSK", "RUNE", "COLT",
];

// Speed tiers: some slower than player, some near-match, one or two faster
// Player max is 58 units. Give NPCs a spread from 70% to 105% of that.
const NPC_SPEED_TIERS = [42, 48, 52, 55, 57, 59, 61, 45, 50, 54];

const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();

export function createTraffic(scene, track, count = 10) {
  const length = track.curve.getLength();
  const racers = [];

  for (let i = 0; i < count; i++) {
    const car = createProceduralCar({ lite: true });
    scene.add(car);

    const marker = new THREE.Mesh(
      new THREE.ConeGeometry(12, 32, 3),
      new THREE.MeshBasicMaterial({ color: 0x3df0ff, fog: false, depthTest: false })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.layers.set(1);
    scene.add(marker);

    const dummy = createVehicle(new THREE.Vector3(), 0);
    const t = (i / count) % 1;
    const topSpeed = NPC_SPEED_TIERS[i % NPC_SPEED_TIERS.length];
    racers.push({
      car,
      marker,
      dummy,
      t,
      lane: (i % 2 === 0 ? 1 : -1) * (2.4 + (i % 3) * 1.2),
      topSpeed,
      // Each racer drives at 88–96% of their top speed normally
      pace: 0.88 + ((i * 3) % 5) * 0.02,
      paint: NPC_PAINT[i % NPC_PAINT.length],
      driverName: RACER_NAMES[i % RACER_NAMES.length],
      lap: 0,
      lastT: t,
    });
    applyLivery(car, racers[i].paint);
  }

  return { racers, length };
}

export function restyleTraffic(traffic, playerLivery = {}) {
  const hex = String(playerLivery.bodyHex || "").toLowerCase();
  const pool = NPC_PAINT.filter((p) => p.bodyHex.toLowerCase() !== hex);
  const paints = pool.length >= 3 ? pool : NPC_PAINT;
  traffic.racers.forEach((r, i) => {
    r.paint = paints[i % paints.length];
    applyLivery(r.car, r.paint);
  });
}

export function stepTraffic(traffic, track, player, dt) {
  for (const r of traffic.racers) {
    // Lap counting for NPCs
    const prevT = r.lastT;
    r.lastT = r.t;
    if (prevT > 0.85 && r.t < 0.15) r.lap += 1;

    let speed = r.topSpeed * r.pace;

    if (player) {
      // Gap: positive means this racer is ahead of player on track
      let gap = r.t - (player.t || 0);
      gap = ((gap + 0.5) % 1) - 0.5;

      // Racers just ahead slow down slightly to stay raceable
      if (gap > 0 && gap < 0.15) speed *= 0.88;
      // Racers behind push harder to catch up
      else if (gap < 0 && gap > -0.18) speed *= 1.08;
    }

    // NPC-to-NPC draft: slow down if another NPC is very close ahead
    for (const other of traffic.racers) {
      if (other === r) continue;
      let d = other.t - r.t;
      d = ((d + 0.5) % 1) - 0.5;
      if (d > 0 && d < 0.015) { speed *= 0.9; break; }
    }

    speed = Math.min(MAX_SPEED * 1.08, Math.max(18, speed));

    r.t = (r.t + (speed * dt) / traffic.length) % 1;
    const pos = track.curve.getPointAt(r.t);
    const tan = track.curve.getTangentAt(r.t).normalize();
    _right.crossVectors(_up, tan);
    if (_right.lengthSq() < 0.0001) _right.set(1, 0, 0);
    else _right.normalize();
    pos.addScaledVector(_right, r.lane);
    pos.y += 0.38;

    r.dummy.position.copy(pos);
    r.dummy.heading = Math.atan2(tan.x, tan.z);
    r.dummy.speed = speed;
    r.dummy.steer = 0;
    syncCarMesh(r.car, r.dummy, dt);

    r.marker.position.set(pos.x, pos.y + 2, pos.z);
    r.marker.rotation.y = r.dummy.heading;
  }
}

// Returns sorted array of { name, t, lap, isPlayer } — P1 first
export function getRacePositions(traffic, player) {
  const all = traffic.racers.map((r) => ({
    name: r.driverName,
    t: r.t,
    lap: r.lap,
    isPlayer: false,
  }));
  all.push({
    name: "YOU",
    t: player.t || 0,
    lap: player.lap || 0,
    isPlayer: true,
  });
  // Sort by lap desc, then track position desc
  all.sort((a, b) => (b.lap - a.lap) || (b.t - a.t));
  return all;
}
