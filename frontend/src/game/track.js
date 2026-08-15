import * as THREE from "three";
import {
  WAYPOINTS,
  ROAD_HALF_WIDTH,
  COLLIDER_RADIUS,
  TRACK_SEGMENTS,
  TUNNEL_T,
  RAIL_HEIGHT,
} from "./trackData.js";
import { makeAsphaltTexture, makeChevronsTexture } from "./textures.js";

const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function createTrack() {
  const points = WAYPOINTS.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.15);

  const samples = [];
  for (let i = 0; i < TRACK_SEGMENTS; i++) {
    const t = i / TRACK_SEGMENTS;
    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(_up, tangent);
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
    else right.normalize();
    samples.push({ t, position, tangent, right });
  }

  const asphalt = makeAsphaltTexture();
  asphalt.repeat.set(1, 24);
  const roadGeo = buildRibbon(samples, ROAD_HALF_WIDTH, 0.12);
  const roadMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: asphalt,
    side: THREE.DoubleSide,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);

  const railGeo = buildKerbs(samples, ROAD_HALF_WIDTH + 0.15, RAIL_HEIGHT);
  const railMat = new THREE.MeshLambertMaterial({
    color: 0x3df0ff,
    emissive: 0x3df0ff,
    emissiveIntensity: 0.85,
    side: THREE.DoubleSide,
  });
  const rails = new THREE.Mesh(railGeo, railMat);

  const bed = buildRoadBed(samples);
  const stripe = buildStartFinish(samples[0], makeChevronsTexture());
  const tunnel = buildTunnel(samples);

  const linePts = samples.map((s) => s.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
  linePts.push(linePts[0].clone());
  const miniLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePts),
    new THREE.LineBasicMaterial({ color: 0x3df0ff })
  );
  miniLine.layers.set(1);

  const group = new THREE.Group();
  group.name = "track";
  group.add(bed, road, rails, stripe, tunnel);

  return {
    group,
    curve,
    samples,
    miniLine,
    roadHalf: ROAD_HALF_WIDTH,
    colliderRadius: COLLIDER_RADIUS,
    _last: 0,
  };
}

function buildRibbon(samples, halfW, yLift) {
  const n = samples.length;
  const positions = new Float32Array(n * 2 * 3);
  const normals = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices = [];

  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const left = _tmp.copy(s.position).addScaledVector(s.right, halfW);
    const right = _tmp2.copy(s.position).addScaledVector(s.right, -halfW);
    left.y += yLift;
    right.y += yLift;
    positions.set([left.x, left.y, left.z], i * 6);
    positions.set([right.x, right.y, right.z], i * 6 + 3);
    normals.set([0, 1, 0], i * 6);
    normals.set([0, 1, 0], i * 6 + 3);
    const v = i / n * 40;
    uvs.set([0, v], i * 4);
    uvs.set([1, v], i * 4 + 2);
  }

  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % n) * 2;
    const d = ((i + 1) % n) * 2 + 1;
    indices.push(a, b, d, a, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildKerbs(samples, offset, height) {
  const n = samples.length;
  const pos = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const s2 = samples[(i + 1) % n];
    for (const sign of [1, -1]) {
      const a = s.position.clone().addScaledVector(s.right, sign * offset);
      const b = a.clone();
      b.y += height;
      const c = s2.position.clone().addScaledVector(s2.right, sign * offset);
      const d = c.clone();
      d.y += height;
      const base = pos.length / 3;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
      if (sign > 0) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildRoadBed(samples) {
  const group = new THREE.Group();
  const deck = new THREE.Mesh(
    buildRibbon(samples, ROAD_HALF_WIDTH + 6.5, -0.55),
    new THREE.MeshLambertMaterial({ color: 0x1c1828, side: THREE.DoubleSide })
  );
  group.add(deck);

  const n = samples.length;
  const pos = [];
  const idx = [];
  const floorY = -0.15;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const s2 = samples[(i + 1) % n];
    for (const sign of [1, -1]) {
      const topA = s.position.clone().addScaledVector(s.right, sign * (ROAD_HALF_WIDTH + 6.5));
      const topB = s2.position.clone().addScaledVector(s2.right, sign * (ROAD_HALF_WIDTH + 6.5));
      const botA = topA.clone();
      botA.y = floorY;
      const botB = topB.clone();
      botB.y = floorY;
      const base = pos.length / 3;
      pos.push(topA.x, topA.y, topA.z, botA.x, botA.y, botA.z, topB.x, topB.y, topB.z, botB.x, botB.y, botB.z);
      if (sign > 0) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  wallGeo.setIndex(idx);
  wallGeo.computeVertexNormals();
  group.add(
    new THREE.Mesh(
      wallGeo,
      new THREE.MeshLambertMaterial({ color: 0x241c32, side: THREE.DoubleSide })
    )
  );
  return group;
}

function buildStartFinish(sample, tex) {
  const w = ROAD_HALF_WIDTH * 2;
  const geo = new THREE.PlaneGeometry(w, 8);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0x443318,
    emissiveIntensity: 0.4,
    roughness: 0.7,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(sample.position);
  mesh.position.y += 0.08;
  const angle = Math.atan2(sample.tangent.x, sample.tangent.z);
  mesh.rotation.y = angle;
  tex.repeat.set(4, 1);
  return mesh;
}

function buildTunnel(samples) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a2438,
    roughness: 0.85,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });
  const neon = new THREE.MeshStandardMaterial({
    color: 0xff2d95,
    emissive: 0xff2d95,
    emissiveIntensity: 0.8,
  });

  const [t0, t1] = TUNNEL_T;
  const half = ROAD_HALF_WIDTH + 4.5;
  const height = 7.5;
  let n = 0;
  for (let i = 0; i < samples.length; i += 6) {
    const s = samples[i];
    if (s.t < t0 || s.t > t1) continue;
    if (n++ > 10) break;
    const arch = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1.2, 0.35, 2.2), neon);
    arch.position.copy(s.position);
    arch.position.y += height;
    const angle = Math.atan2(s.tangent.x, s.tangent.z);
    arch.rotation.y = angle;
    group.add(arch);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.5, height, 2.2), mat);
    left.position.copy(s.position).addScaledVector(s.right, half);
    left.position.y += height / 2;
    left.rotation.y = angle;
    const right = left.clone();
    right.position.copy(s.position).addScaledVector(s.right, -half);
    right.position.y += height / 2;
    group.add(left, right);
  }
  return group;
}

export function closestSample(track, pos) {
  const samples = track.samples;
  const n = samples.length;
  let best = track._last || 0;
  let bestD = pos.distanceToSquared(samples[best].position);
  const window = 18;
  for (let k = -window; k <= window; k++) {
    const i = (best + k + n) % n;
    const d = pos.distanceToSquared(samples[i].position);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (bestD > 6400) {
    for (let i = 0; i < n; i++) {
      const d = pos.distanceToSquared(samples[i].position);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  track._last = best;
  return samples[best];
}

export function constrainToTrack(track, vehicle, dt) {
  const sample = closestSample(track, vehicle.position);
  const toCar = _tmp.copy(vehicle.position).sub(sample.position);
  const lateral = toCar.dot(sample.right);
  const maxLat = track.roadHalf - track.colliderRadius;
  let againstRail = false;

  vehicle.position.y = sample.position.y + 0.38;

  if (Math.abs(lateral) > maxLat) {
    againstRail = true;
    const excess = Math.abs(lateral) - maxLat;
    vehicle.position.addScaledVector(sample.right, -Math.sign(lateral) * excess);
    vehicle.speed *= 0.94;
    if (Math.abs(vehicle.speed) > 4) {
      vehicle.heading += -Math.sign(lateral) * 0.15 * dt;
    }
  }

  if (againstRail && Math.abs(vehicle.speed) < 2.2) {
    vehicle.stuckTime += dt;
  } else {
    vehicle.stuckTime = 0;
  }

  if (vehicle.stuckTime > 1.0) {
    vehicle.position.lerp(sample.position, 0.2);
    vehicle.position.y = sample.position.y + 0.38;
    vehicle.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
    vehicle.speed = 6;
    vehicle.stuckTime = 0;
  }

  vehicle.sampleIndex = track._last || 0;
  vehicle.t = sample.t;
  return sample;
}
