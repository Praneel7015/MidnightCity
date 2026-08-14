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

export function createTrack(textureLoader) {
  const points = WAYPOINTS.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.15);

  const samples = [];
  for (let i = 0; i < TRACK_SEGMENTS; i++) {
    const t = i / TRACK_SEGMENTS;
    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const right = _tmp.crossVectors(_up, tangent).normalize().clone();
    if (right.lengthSq() < 0.01) {
      right.set(1, 0, 0);
    }
    samples.push({ t, position, tangent, right });
  }

  const asphalt = makeAsphaltTexture();
  asphalt.repeat.set(1, 40);
  const roadGeo = buildRibbon(samples, ROAD_HALF_WIDTH, 0.04);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x889099,
    map: asphalt,
    roughness: 0.92,
    metalness: 0.08,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;

  const railGeo = buildRails(samples, ROAD_HALF_WIDTH + 0.25, RAIL_HEIGHT);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x3df0ff,
    emissive: 0x0a3a44,
    emissiveIntensity: 0.65,
    roughness: 0.4,
    metalness: 0.6,
  });
  const rails = new THREE.Mesh(railGeo, railMat);

  const stripe = buildStartFinish(samples[0], makeChevronsTexture());
  const tunnel = buildTunnel(samples);

  const linePts = samples.map((s) => s.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
  linePts.push(linePts[0].clone());
  const miniLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePts),
    new THREE.LineBasicMaterial({ color: 0x3df0ff, linewidth: 2 })
  );
  miniLine.layers.set(1);
  const miniRoad = new THREE.Mesh(
    buildRibbon(
      samples.map((s) => ({
        ...s,
        position: s.position.clone().add(new THREE.Vector3(0, 0.9, 0)),
      })),
      ROAD_HALF_WIDTH,
      0
    ),
    new THREE.MeshBasicMaterial({ color: 0x5a6678, fog: false })
  );
  miniRoad.layers.set(1);

  const group = new THREE.Group();
  group.name = "track";
  group.add(road, rails, stripe, tunnel, miniRoad);

  if (textureLoader) {
    textureLoader.load(
      "/assets/asphalt_02_diff_1k.jpg",
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 48);
        tex.anisotropy = 8;
        tex.colorSpace = THREE.SRGBColorSpace;
        roadMat.map = tex;
        roadMat.needsUpdate = true;
      },
      undefined,
      () => {}
    );
  }

  return {
    group,
    curve,
    samples,
    miniLine,
    roadHalf: ROAD_HALF_WIDTH,
    colliderRadius: COLLIDER_RADIUS,
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
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRails(samples, offset, height) {
  const n = samples.length;
  const geo = new THREE.BufferGeometry();
  const pos = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    for (const sign of [1, -1]) {
      const inner = s.position.clone().addScaledVector(s.right, sign * (offset - 0.16));
      const outer = s.position.clone().addScaledVector(s.right, sign * (offset + 0.16));
      const i2 = (i + 1) % n;
      const s2 = samples[i2];
      const inner2 = s2.position.clone().addScaledVector(s2.right, sign * (offset - 0.16));
      const outer2 = s2.position.clone().addScaledVector(s2.right, sign * (offset + 0.16));
      const b = pos.length / 3;
      const pts = [
        inner,
        outer,
        inner.clone().setY(inner.y + height),
        outer.clone().setY(outer.y + height),
        inner2,
        outer2,
        inner2.clone().setY(inner2.y + height),
        outer2.clone().setY(outer2.y + height),
      ];
      for (const p of pts) pos.push(p.x, p.y, p.z);
      const faces = [
        0, 1, 3, 0, 3, 2, 1, 5, 7, 1, 7, 3, 0, 2, 6, 0, 6, 4, 2, 3, 7, 2, 7, 6, 4, 6, 7, 4, 7, 5,
      ];
      for (const f of faces) idx.push(b + f);
    }
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
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
    color: 0x151520,
    roughness: 0.9,
    metalness: 0.2,
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
  for (const s of samples) {
    if (s.t < t0 || s.t > t1) continue;
    if (Math.floor(s.t * 200) % 2 !== 0) continue;
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
  let best = 0;
  let bestD = Infinity;
  const samples = track.samples;
  for (let i = 0; i < samples.length; i++) {
    const d = pos.distanceToSquared(samples[i].position);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
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

  vehicle.sampleIndex = track.samples.indexOf(sample);
  vehicle.t = sample.t;
  return sample;
}
