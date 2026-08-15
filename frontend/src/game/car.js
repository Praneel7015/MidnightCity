import * as THREE from "three";
import { checkpointCount } from "./trackData.js";

export const MAX_SPEED = 58;
export const REVERSE_MAX = 14;
const ACCEL = 38;
const BRAKE = 55;
const REVERSE_ACCEL = 18;
const COAST = 6;
const STEER_RATE = 2.05;

export function createVehicle(startPos, heading) {
  return {
    position: startPos.clone(),
    heading,
    speed: 0,
    steer: 0,
    stuckTime: 0,
    t: 0,
    sampleIndex: 0,
    checkpoint: 0,
    lap: 0,
    lapTime: 0,
    bestLap: null,
    armed: false,
  };
}

export function stepVehicle(v, input, dt) {
  dt = Math.min(dt, 0.05);
  const targetSteer = (input.left ? 1 : 0) + (input.right ? -1 : 0);
  v.steer += (targetSteer - v.steer) * Math.min(1, dt * 10);

  if (input.throttle) v.speed += ACCEL * dt;
  if (input.brake) {
    if (v.speed > 0.6) v.speed -= BRAKE * dt;
    else v.speed -= REVERSE_ACCEL * dt;
  } else if (input.reverse) {
    v.speed -= REVERSE_ACCEL * dt;
  } else if (!input.throttle) {
    if (v.speed > 0) v.speed = Math.max(0, v.speed - COAST * dt);
    else if (v.speed < 0) v.speed = Math.min(0, v.speed + COAST * dt);
  }

  v.speed = Math.max(-REVERSE_MAX, Math.min(MAX_SPEED, v.speed));

  const speedRatio = Math.min(Math.abs(v.speed) / MAX_SPEED, 1);
  const steerRate = STEER_RATE * (1.15 - 0.75 * speedRatio);
  if (Math.abs(v.speed) > 0.4) {
    v.heading += v.steer * steerRate * dt * Math.sign(v.speed);
  }

  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  v.position.x += fx * v.speed * dt;
  v.position.z += fz * v.speed * dt;
}

export function updateLaps(v) {
  const n = checkpointCount();
  const cp = Math.floor(((((v.t % 1) + 1) % 1) * n));
  const last = v.checkpoint;
  if (cp === (last + 1) % n) {
    v.checkpoint = cp;
    if (cp === 1) v.armed = true;
    if (cp === 0 && v.armed) {
      v.lap += 1;
      if (v.bestLap == null || v.lapTime < v.bestLap) v.bestLap = v.lapTime;
      v.lapTime = 0;
    }
  }
}

export function resetVehicle(v, track) {
  const sample = track.samples[v.sampleIndex] || track.samples[0];
  v.position.copy(sample.position);
  v.position.y += 0.38;
  v.heading = Math.atan2(sample.tangent.x, sample.tangent.z);
  v.speed = 0;
  v.steer = 0;
  v.stuckTime = 0;
}

export function applyLivery(car, livery) {
  const mats = car.userData.materials;
  if (!mats) return;

  if (livery.bodyHex) {
    mats.body.color.set(livery.bodyHex);
    mats.body.needsUpdate = true;
  }

  // Lower-panel two-tone accent
  if (mats.lower) {
    const lowerHex = livery.lowerHex || livery.bodyHex || "#111118";
    mats.lower.color.set(lowerHex);
    mats.lower.needsUpdate = true;
  }

  // Racing stripe on hood/roof
  if (mats.stripe) {
    const stripeHex = livery.stripeHex || null;
    if (stripeHex) {
      mats.stripe.color.set(stripeHex);
      mats.stripe.visible = true;
    } else {
      mats.stripe.visible = false;
    }
    mats.stripe.needsUpdate = true;
  }

  // Rim finish: chrome | matte | color
  if (mats.rim) {
    const finish = livery.rimFinish || "chrome";
    if (finish === "matte") {
      mats.rim.color.set(livery.rimHex || "#888899");
      mats.rim.metalness = 0.3;
      mats.rim.roughness = 0.85;
    } else if (finish === "color") {
      mats.rim.color.set(livery.rimHex || "#ffffff");
      mats.rim.metalness = 0.55;
      mats.rim.roughness = 0.35;
    } else {
      // chrome (default)
      mats.rim.color.set(livery.rimHex || "#d8dbe8");
      mats.rim.metalness = 0.85;
      mats.rim.roughness = 0.22;
    }
    mats.rim.needsUpdate = true;
  }

  if (livery.glowHex && mats.glow) {
    mats.glow.color.set(livery.glowHex);
    mats.glow.emissive.set(livery.glowHex);
    mats.glow.needsUpdate = true;
  }
  if (car.userData.glowLight && livery.glowHex) {
    car.userData.glowLight.color.set(livery.glowHex);
  }
  if (car.userData.spoiler) {
    car.userData.spoiler.visible = livery.spoiler !== false;
    // Spoiler can match body or stripe color
    const spoilerMat = car.userData.spoilerMat;
    if (spoilerMat && livery.stripeHex) {
      spoilerMat.color.set(livery.stripeHex);
      spoilerMat.needsUpdate = true;
    } else if (spoilerMat && livery.bodyHex) {
      spoilerMat.color.set(livery.bodyHex);
      spoilerMat.needsUpdate = true;
    }
  }
  if (car.userData.headlights) {
    for (const h of car.userData.headlights) h.visible = livery.headlights !== false;
  }
}

export function syncCarMesh(car, v, dt) {
  car.position.copy(v.position);
  car.rotation.order = "YXZ";
  car.rotation.y = v.heading;
  car.rotation.z = THREE.MathUtils.damp(car.rotation.z, v.steer * 0.12, 8, dt);
  car.rotation.x = THREE.MathUtils.damp(car.rotation.x, -v.speed * 0.002, 8, dt);

  const wheels = car.userData.wheels || [];
  const spin = (v.speed * dt) / 0.38;
  for (const w of wheels) {
    w.rotation.x += spin;
  }
  const fronts = car.userData.frontWheels || [];
  for (const w of fronts) {
    w.parent.rotation.y = v.steer * 0.45;
  }
}

export async function loadCar(scene, opts) {
  const car = createProceduralCar(opts);
  scene.add(car);
  return car;
}

function coupeProfile() {
  const s = new THREE.Shape();
  s.moveTo(-2.18, 0.2);
  s.lineTo(2.08, 0.2);
  s.bezierCurveTo(2.38, 0.2, 2.48, 0.36, 2.4, 0.52);
  s.lineTo(2.18, 0.64);
  s.lineTo(0.92, 0.78);
  s.bezierCurveTo(0.48, 0.84, 0.18, 1.16, -0.12, 1.28);
  s.lineTo(-0.92, 1.3);
  s.bezierCurveTo(-1.32, 1.26, -1.62, 1.02, -1.78, 0.8);
  s.lineTo(-2.22, 0.66);
  s.bezierCurveTo(-2.36, 0.52, -2.32, 0.26, -2.18, 0.2);
  return s;
}

function cabinProfile() {
  const s = new THREE.Shape();
  s.moveTo(0.62, 0.82);
  s.lineTo(-0.08, 1.22);
  s.lineTo(-0.88, 1.24);
  s.lineTo(-1.42, 0.94);
  s.lineTo(-1.05, 0.82);
  s.lineTo(0.35, 0.82);
  s.closePath();
  return s;
}

function meshFromProfile(shape, width, material, bevel = 0.07) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export function createProceduralCar({ lite = false } = {}) {
  const root = new THREE.Group();
  root.name = lite ? "npc" : "car";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x14c8d4,
    metalness: 0.42,
    roughness: 0.38,
    envMapIntensity: 0.9,
  });
  // Two-tone lower panel (side sills / lower body)
  const lowerMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a14,
    metalness: 0.38,
    roughness: 0.55,
  });
  // Racing stripe — hidden by default, revealed via livery
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.3,
    roughness: 0.45,
    visible: false,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    metalness: 0.4,
    roughness: 0.5,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8ecbff,
    metalness: 0.92,
    roughness: 0.06,
    transparent: true,
    opacity: 0.38,
    envMapIntensity: 1.4,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd8dbe8,
    metalness: 0.85,
    roughness: 0.22,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x3df0ff,
    emissive: 0x3df0ff,
    emissiveIntensity: 0.9,
    side: THREE.DoubleSide,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff4cc,
    emissive: 0xfff1b0,
    emissiveIntensity: 1.4,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2244,
    emissive: 0xff0022,
    emissiveIntensity: 1.1,
  });

  const body = meshFromProfile(coupeProfile(), 1.72, bodyMat, 0.09);
  const cabin = meshFromProfile(cabinProfile(), 1.42, glassMat, 0.04);

  // Lower body side-skirt panel (two-tone accent)
  const lowerPanel = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.18, 1.6),
    lowerMat
  );
  lowerPanel.position.set(0, 0.27, 0);

  // Roof racing stripe — thin box running front-to-back over the cabin
  const stripeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.012, 1.35),
    stripeMat
  );
  stripeRoof.position.set(0, 1.32, -0.22);

  // Hood racing stripe
  const stripeHood = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.012, 1.15),
    stripeMat
  );
  stripeHood.position.set(0, 0.78, 1.25);

  const skirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 3.15, 4, 8), darkMat);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.set(0, 0.28, 0);

  const spoilerPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8), darkMat);
  spoilerPostL.position.set(-0.52, 0.98, -1.92);
  const spoilerPostR = spoilerPostL.clone();
  spoilerPostR.position.x = 0.52;

  // Spoiler uses its own cloned body mat so it can be re-colored independently
  const spoilerMat = bodyMat.clone();
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, 0.36), spoilerMat);
  spoiler.position.set(0, 1.14, -1.92);

  const headL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), headMat);
  headL.scale.set(1.35, 0.7, 0.55);
  headL.position.set(-0.58, 0.54, 2.28);
  const headR = headL.clone();
  headR.position.x = 0.58;
  const tailL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), tailMat);
  tailL.scale.set(1.5, 0.55, 0.4);
  tailL.position.set(-0.58, 0.56, -2.12);
  const tailR = tailL.clone();
  tailR.position.x = 0.58;

  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 3.3), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.07;

  root.add(
    body, lowerPanel, stripeRoof, stripeHood,
    cabin, skirt, spoilerPostL, spoilerPostR, spoiler,
    headL, headR, tailL, tailR, glowPlane
  );

  const wheels = [];
  const frontWheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  function makeWheel(x, z, front) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 14), rimMat);
    rim.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), darkMat);
    hub.rotation.z = Math.PI / 2;
    pivot.add(tire, rim, hub);
    root.add(pivot);
    wheels.push(tire);
    if (front) frontWheels.push(tire);
    return pivot;
  }
  makeWheel(-0.88, 1.28, true);
  makeWheel(0.88, 1.28, true);
  makeWheel(-0.88, -1.32, false);
  makeWheel(0.88, -1.32, false);

  const glowLight = new THREE.PointLight(0x3df0ff, lite ? 0.9 : 2.2, lite ? 5 : 8, 2);
  glowLight.position.set(0, 0.2, 0);
  root.add(glowLight);

  const headlights = [headL, headR];
  if (!lite) {
    const spot = new THREE.SpotLight(0xfff2d0, 4, 36, 0.4, 0.45, 1.4);
    spot.position.set(0, 0.6, 2.2);
    spot.target.position.set(0, 0.2, 16);
    root.add(spot, spot.target);
    headlights.push(spot);
  }

  root.userData.materials = { body: bodyMat, lower: lowerMat, stripe: stripeMat, rim: rimMat, glow: glowMat };
  root.userData.spoiler = spoiler;
  root.userData.spoilerMat = spoilerMat;
  root.userData.wheels = wheels;
  root.userData.frontWheels = frontWheels;
  root.userData.glowLight = glowLight;
  root.userData.headlights = headlights;
  return root;
}
