import * as THREE from "three";
import { checkpointCount } from "./trackData.js";

export const MAX_SPEED = 68;
export const REVERSE_MAX = 14;
// Drag coefficient — multiplied by speed² to create resistance.
// Terminal velocity ≈ sqrt(ACCEL / DRAG). At 22/0.0055 ≈ 63 units → ~360 km/h.
const ACCEL = 22;
const DRAG = 0.0055;
const BRAKE = 55;
const REVERSE_ACCEL = 18;
const COAST = 4;
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

  if (input.throttle) {
    const drag = DRAG * v.speed * Math.abs(v.speed);
    v.speed += (ACCEL - drag) * dt;
  }
  if (input.brake) {
    if (v.speed > 0.6) v.speed -= BRAKE * dt;
    else v.speed -= REVERSE_ACCEL * dt;
  } else if (input.reverse) {
    v.speed -= REVERSE_ACCEL * dt;
  } else if (!input.throttle) {
    // Passive aero drag even when coasting
    const passiveDrag = DRAG * 0.5 * v.speed * Math.abs(v.speed);
    if (v.speed > 0) v.speed = Math.max(0, v.speed - (COAST + passiveDrag) * dt);
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

export function syncCarMesh(car, v, dt, input) {
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

  // Brake light brightens when braking
  const braking = input?.brake || (v.speed > 1 && v.accel < 0);
  const rearLight = car.userData.rearLight;
  if (rearLight) rearLight.intensity = THREE.MathUtils.damp(rearLight.intensity, braking ? 4.5 : 1.8, 10, dt);
  const brakeStrip = car.userData.brakeStrip;
  if (brakeStrip) brakeStrip.material.opacity = THREE.MathUtils.damp(brakeStrip.material.opacity, braking ? 0.85 : 0.4, 10, dt);
}

export async function loadCar(scene, opts) {
  const car = createProceduralCar(opts);
  scene.add(car);
  return car;
}

function coupeProfile() {
  // Realistic low-slung sports coupe side silhouette (Z-is-up, X-is-length)
  const s = new THREE.Shape();
  s.moveTo(-2.28, 0.12); // rear splitter low
  s.lineTo(2.12, 0.12);  // front splitter low
  s.bezierCurveTo(2.52, 0.12, 2.62, 0.28, 2.52, 0.46); // front nose curve
  s.lineTo(2.28, 0.58);  // front hood rise
  s.lineTo(0.96, 0.72);  // hood
  s.bezierCurveTo(0.52, 0.78, 0.22, 1.08, -0.06, 1.24); // A-pillar sweep
  s.lineTo(-0.78, 1.32); // roof
  s.bezierCurveTo(-1.18, 1.30, -1.52, 1.14, -1.72, 0.92); // C-pillar
  s.bezierCurveTo(-2.08, 0.72, -2.28, 0.52, -2.28, 0.12); // rear deck & boot
  s.closePath();
  return s;
}

function cabinProfile() {
  // Fastback greenhouse — raked windscreen, long sloping roofline
  const s = new THREE.Shape();
  s.moveTo(0.72, 0.74);   // base front
  s.lineTo(0.02, 1.18);   // windscreen top
  s.lineTo(-0.72, 1.30);  // roof
  s.lineTo(-1.38, 1.06);  // rear pillar top
  s.bezierCurveTo(-1.62, 0.88, -1.55, 0.74, -1.38, 0.74);
  s.lineTo(0.72, 0.74);
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
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff8e0,
    emissiveIntensity: 3.5,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff1a1a,
    emissive: 0xff0000,
    emissiveIntensity: 3.2,
  });

  // Lens glow material factory — used inline per light cluster
  function makeLensMat(hex) {
    return new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }
  void makeLensMat; // defined for reference; actual mats inlined below

  const body = meshFromProfile(coupeProfile(), 1.76, bodyMat, 0.11);
  const cabin = meshFromProfile(cabinProfile(), 1.46, glassMat, 0.05);

  // Front bumper / chin spoiler — Z is car-length, X is car-width
  const bumperMat = darkMat;
  const bumperCenter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.18), bumperMat);
  bumperCenter.position.set(0, 0.22, 2.42);
  const bumperL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), bumperMat);
  bumperL.position.set(-0.56, 0.2, 2.4);
  const bumperR = bumperL.clone();
  bumperR.position.x = 0.56;

  // Front intake slots
  const intakeMat = new THREE.MeshStandardMaterial({ color: 0x060608, roughness: 0.9 });
  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.08), intakeMat);
  intakeL.position.set(-0.32, 0.28, 2.47);
  const intakeR = intakeL.clone();
  intakeR.position.x = 0.32;

  // Rear diffuser  (X=width, Y=height, Z=depth)
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 0.28), bumperMat);
  diffuser.position.set(0, 0.2, -2.32);
  diffuser.rotation.x = 0.25;

  // Dual exhausts — rotated so the open end faces rearward (Z axis)
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.9, roughness: 0.3 });
  const exhaustGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.22, 10);
  exhaustGeo.rotateX(Math.PI / 2); // open end faces -Z (rear)
  const exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustL.position.set(-0.34, 0.27, -2.32);
  const exhaustR = exhaustL.clone();
  exhaustR.position.x = 0.34;

  // Side-skirt lower panel — X=car width (~1.72), Z=car length (~3.6)
  const lowerPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.16, 3.6),
    lowerMat
  );
  lowerPanel.position.set(0, 0.22, 0);

  // Roof racing stripe — X=stripe width, Z=stripe length along car
  const stripeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.014, 1.38),
    stripeMat
  );
  stripeRoof.position.set(0, 1.32, -0.28);

  // Hood racing stripe
  const stripeHood = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.014, 1.15),
    stripeMat
  );
  stripeHood.position.set(0, 0.74, 1.18);

  // Side skirt tube running along the sill (CapsuleGeometry axis is Y by default, rotate to Z)
  const skirt = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.1, 3.1, 4, 8), darkMat
  );
  skirt.rotation.x = Math.PI / 2;
  skirt.position.set(0, 0.19, 0);

  const spoilerPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8), darkMat);
  spoilerPostL.position.set(-0.48, 1.04, -2.0);
  const spoilerPostR = spoilerPostL.clone();
  spoilerPostR.position.x = 0.48;

  // Spoiler blade — X=width matching car body, Z=blade chord
  const spoilerMat = bodyMat.clone();
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.055, 0.34), spoilerMat);
  spoiler.position.set(0, 1.18, -2.0);

  // Spoiler end-plates — width X is thin, height Y, depth Z matches blade
  const plateGeo = new THREE.BoxGeometry(0.055, 0.17, 0.34);
  const plateL = new THREE.Mesh(plateGeo, spoilerMat);
  plateL.position.set(-0.73, 1.18, -2.0);
  const plateR = plateL.clone();
  plateR.position.x = 0.73;

  // ── HEADLIGHTS ────────────────────────────────────────────────────────────
  // Push well in front of the body face (~z=2.52) so they're not buried inside

  // Outer headlight housing recess (dark surround)
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.7 });
  const housingL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.12), housingMat);
  housingL.position.set(-0.52, 0.5, 2.52);
  const housingR = housingL.clone();
  housingR.position.x = 0.52;
  const housingInnerL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.1), housingMat);
  housingInnerL.position.set(-0.25, 0.54, 2.52);
  const housingInnerR = housingInnerL.clone();
  housingInnerR.position.x = 0.25;

  // Bright emissive lens bulbs protruding from housing
  const headL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), headMat);
  headL.scale.set(1.1, 0.55, 0.4);
  headL.position.set(-0.52, 0.5, 2.59);
  const headR = headL.clone();
  headR.position.x = 0.52;

  const headInnerL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), headMat);
  headInnerL.scale.set(1.0, 0.65, 0.4);
  headInnerL.position.set(-0.25, 0.54, 2.59);
  const headInnerR = headInnerL.clone();
  headInnerR.position.x = 0.25;

  // DRL strip — thin emissive bar running under the outer lens
  const drlMat = new THREE.MeshBasicMaterial({
    color: 0xfff8e0,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const drlL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.04), drlMat);
  drlL.position.set(-0.52, 0.38, 2.58);
  const drlR = drlL.clone();
  drlR.position.x = 0.52;

  // Additive lens glow planes — face FORWARD (+Z) to be visible from front,
  // and also face BACKWARD so they bloom in the chase cam view
  const lensGeo = new THREE.PlaneGeometry(0.42, 0.25);
  const headGlowMat2 = new THREE.MeshBasicMaterial({
    color: 0xfff8d0,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, // visible from both front AND behind
  });
  const headGlowL = new THREE.Mesh(lensGeo, headGlowMat2);
  headGlowL.position.set(-0.52, 0.5, 2.62);
  const headGlowR = new THREE.Mesh(lensGeo, headGlowMat2);
  headGlowR.position.set(0.52, 0.5, 2.62);
  const headGlowInnerMat = new THREE.MeshBasicMaterial({
    color: 0xfff8d0,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const headGlowInnerL = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.18), headGlowInnerMat);
  headGlowInnerL.position.set(-0.25, 0.54, 2.62);
  const headGlowInnerR = headGlowInnerL.clone();
  headGlowInnerR.position.x = 0.25;

  // ── TAILLIGHTS ────────────────────────────────────────────────────────────
  // Dark housing recess at rear
  const tailHousingL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), housingMat);
  tailHousingL.position.set(-0.52, 0.54, -2.28);
  const tailHousingR = tailHousingL.clone();
  tailHousingR.position.x = 0.52;

  const tailL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6), tailMat);
  tailL.scale.set(1.7, 0.5, 0.38);
  tailL.position.set(-0.52, 0.54, -2.34);
  const tailR = tailL.clone();
  tailR.position.x = 0.52;

  // Tail lens glow — DoubleSide so chase cam sees them
  const tailGlowMat2 = new THREE.MeshBasicMaterial({
    color: 0xff1111,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const tailLensGeo = new THREE.PlaneGeometry(0.44, 0.2);
  const tailGlowL = new THREE.Mesh(tailLensGeo, tailGlowMat2);
  tailGlowL.rotation.y = Math.PI;
  tailGlowL.position.set(-0.52, 0.54, -2.36);
  const tailGlowR = new THREE.Mesh(tailLensGeo, tailGlowMat2);
  tailGlowR.rotation.y = Math.PI;
  tailGlowR.position.set(0.52, 0.54, -2.36);

  // Full-width LED strip at rear
  const rearStripMat = new THREE.MeshBasicMaterial({
    color: 0xff1111,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const rearLedStrip = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.035), rearStripMat);
  rearLedStrip.rotation.y = Math.PI;
  rearLedStrip.position.set(0, 0.38, -2.35);

  // Brake light strip — same rear-facing plane, brightens on brake
  const brakeMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const brakeStrip = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.06), brakeMat);
  brakeStrip.rotation.y = Math.PI;
  brakeStrip.position.set(0, 0.56, -2.36);

  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.5), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.04;

  root.add(
    body,
    bumperCenter, bumperL, bumperR,
    intakeL, intakeR,
    diffuser, exhaustL, exhaustR,
    lowerPanel, stripeRoof, stripeHood,
    cabin, skirt,
    spoilerPostL, spoilerPostR, spoiler, plateL, plateR,
    housingL, housingR, housingInnerL, housingInnerR,
    headL, headR, headInnerL, headInnerR,
    drlL, drlR,
    headGlowL, headGlowR, headGlowInnerL, headGlowInnerR,
    tailHousingL, tailHousingR,
    tailL, tailR, tailGlowL, tailGlowR,
    rearLedStrip, brakeStrip,
    glowPlane
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

  // Front white point light — strong enough to paint the road white ahead
  const frontLight = new THREE.PointLight(0xfff8d0, lite ? 1.8 : 5.5, lite ? 14 : 28, 1.6);
  frontLight.position.set(0, 0.55, 2.8);
  root.add(frontLight);

  // Rear red point light
  const rearLight = new THREE.PointLight(0xff1100, lite ? 0.8 : 2.5, lite ? 8 : 14, 2);
  rearLight.position.set(0, 0.55, -2.6);
  root.add(rearLight);

  const headlights = [
    headL, headR, headInnerL, headInnerR,
    drlL, drlR,
    headGlowL, headGlowR, headGlowInnerL, headGlowInnerR,
    frontLight,
  ];
  if (!lite) {
    // Narrow spotlight beam down the road
    const spot = new THREE.SpotLight(0xfff2d0, 6, 48, 0.38, 0.5, 1.4);
    spot.position.set(0, 0.65, 2.4);
    spot.target.position.set(0, 0.1, 20);
    root.add(spot, spot.target);
    headlights.push(spot);
  }

  root.userData.materials = { body: bodyMat, lower: lowerMat, stripe: stripeMat, rim: rimMat, glow: glowMat };
  root.userData.spoiler = spoiler;
  root.userData.spoilerMat = spoilerMat;
  root.userData.wheels = wheels;
  root.userData.frontWheels = frontWheels;
  root.userData.glowLight = glowLight;
  root.userData.rearLight = rearLight;
  root.userData.brakeStrip = brakeStrip;
  root.userData.headlights = headlights;
  root.userData.plateL = plateL;
  root.userData.plateR = plateR;
  return root;
}
