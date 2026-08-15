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

const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3();

export function createTraffic(scene, track, count = 7) {
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
    racers.push({
      car,
      marker,
      dummy,
      t: ((i + 1) * 0.118) % 1,
      lane: (i % 2 === 0 ? 1 : -1) * (2.6 + (i % 3) * 1.15),
      cruise: 16 + ((i * 7) % 30),
      pace: 0.82 + (i % 4) * 0.09,
      paint: NPC_PAINT[i % NPC_PAINT.length],
    });
    applyLivery(car, racers[i].paint);
  }

  return { racers, length };
}

export function restyleTraffic(traffic, playerLivery = {}) {
  const hex = String(playerLivery.bodyHex || "").toLowerCase();
  const name = playerLivery.name;
  const pool = NPC_PAINT.filter((p) => p.name !== name && p.bodyHex.toLowerCase() !== hex);
  const paints = pool.length ? pool : NPC_PAINT;
  traffic.racers.forEach((r, i) => {
    r.paint = paints[i % paints.length];
    applyLivery(r.car, r.paint);
  });
}

export function stepTraffic(traffic, track, player, dt) {
  for (const r of traffic.racers) {
    let speed = r.cruise * r.pace;
    if (player) {
      let gap = r.t - (player.t || 0);
      gap = ((gap + 0.5) % 1) - 0.5;
      if (gap > 0.2) speed *= 0.7;
      else if (gap < -0.2) speed *= 1.38;
    }
    speed = Math.min(MAX_SPEED * 0.9, Math.max(10, speed));

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
