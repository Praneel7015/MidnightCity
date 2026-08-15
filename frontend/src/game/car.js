import * as THREE from "three";
import { checkpointCount } from "./trackData.js";

export const MAX_SPEED = 58;
export const REVERSE_MAX = 14;
// Drag coefficient — multiplied by speed² to create resistance.
// This makes 0-200 feel quick but 200-360 takes sustained throttle.
const ACCEL = 22;
const DRAG = 0.0088;
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

function fenderBulge(front) {
  // Wheel-arch bulge shape — small lens that sits over the wheelwell
  const s = new THREE.Shape();
  const cx = front ? 1.22 : -1.28;
  const r = 0.55;
  s.moveTo(cx - r, 0.32);
  s.bezierCurveTo(cx - r, 0.78, cx + r, 0.78, cx + r, 0.32);
  s.lineTo(cx - r, 0.32);
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
    color: 0xfff4cc,
    emissive: 0xfff1b0,
    emissiveIntensity: 1.4,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2244,
    emissive: 0xff0022,
    emissiveIntensity: 1.1,
  });

  const body = meshFromProfile(coupeProfile(), 1.76, bodyMat, 0.11);
  const cabin = meshFromProfile(cabinProfile(), 1.46, glassMat, 0.05);

  // Wide fender flares over wheel arches
  const fenderFrontL = meshFromProfile(fenderBulge(true), 0.18, bodyMat, 0.04);
  fenderFrontL.position.set(-0.95, 0, 0);
  const fenderFrontR = fenderFrontL.clone();
  fenderFrontR.position.set(0.95, 0, 0);
  const fenderRearL = meshFromProfile(fenderBulge(false), 0.18, bodyMat, 0.04);
  fenderRearL.position.set(-0.95, 0, 0);
  const fenderRearR = fenderRearL.clone();
  fenderRearR.position.set(0.95, 0, 0);

  // Front bumper / chin spoiler
  const bumperMat = darkMat;
  const bumperCenter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.18), bumperMat);
  bumperCenter.position.set(0, 0.22, 2.42);
  const bumperL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.22), bumperMat);
  bumperL.position.set(-0.62, 0.2, 2.4);
  const bumperR = bumperL.clone();
  bumperR.position.x = 0.62;

  // Front intake mesh (dark slot)
  const intakeMat = new THREE.MeshStandardMaterial({ color: 0x060608, roughness: 0.9 });
  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.08), intakeMat);
  intakeL.position.set(-0.38, 0.28, 2.46);
  const intakeR = intakeL.clone();
  intakeR.position.x = 0.38;

  // Rear diffuser
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.32), bumperMat);
  diffuser.position.set(0, 0.2, -2.32);
  diffuser.rotation.x = 0.25;

  // Dual exhausts
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.9, roughness: 0.3 });
  const exhaustGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.22, 10);
  exhaustGeo.rotateZ(Math.PI / 2);
  const exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustL.position.set(-0.36, 0.28, -2.3);
  const exhaustR = exhaustL.clone();
  exhaustR.position.x = 0.36;

  // Lower body side-skirt panel (two-tone accent)
  const lowerPanel = new THREE.Mesh(
    new THREE.BoxGeometry(3.72, 0.16, 1.58),
    lowerMat
  );
  lowerPanel.position.set(0, 0.22, 0);

  // Roof racing stripe — thin box running front-to-back over the cabin
  const stripeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.014, 1.4),
    stripeMat
  );
  stripeRoof.position.set(0, 1.32, -0.28);

  // Hood racing stripe
  const stripeHood = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.014, 1.2),
    stripeMat
  );
  stripeHood.position.set(0, 0.74, 1.18);

  const skirt = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 3.25, 4, 8), darkMat
  );
  skirt.rotation.x = Math.PI / 2;
  skirt.position.set(0, 0.22, 0);

  const spoilerPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.3, 8), darkMat);
  spoilerPostL.position.set(-0.5, 1.02, -2.0);
  const spoilerPostR = spoilerPostL.clone();
  spoilerPostR.position.x = 0.5;

  // Spoiler uses its own cloned body mat so it can be re-colored independently
  const spoilerMat = bodyMat.clone();
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.38), spoilerMat);
  spoiler.position.set(0, 1.18, -2.0);

  // Spoiler end-plates
  const plateGeo = new THREE.BoxGeometry(0.06, 0.18, 0.36);
  const plateL = new THREE.Mesh(plateGeo, spoilerMat);
  plateL.position.set(-0.78, 1.18, -2.0);
  const plateR = plateL.clone();
  plateR.position.x = 0.78;

  const headL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), headMat);
  headL.scale.set(1.4, 0.65, 0.5);
  headL.position.set(-0.55, 0.5, 2.4);
  const headR = headL.clone();
  headR.position.x = 0.55;
  // Inner headlight cluster
  const headInnerL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), headMat);
  headInnerL.scale.set(1.1, 0.7, 0.5);
  headInnerL.position.set(-0.3, 0.54, 2.44);
  const headInnerR = headInnerL.clone();
  headInnerR.position.x = 0.3;

  const tailL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), tailMat);
  tailL.scale.set(1.6, 0.5, 0.38);
  tailL.position.set(-0.55, 0.54, -2.2);
  const tailR = tailL.clone();
  tailR.position.x = 0.55;

  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.5), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.04;

  root.add(
    body,
    fenderFrontL, fenderFrontR, fenderRearL, fenderRearR,
    bumperCenter, bumperL, bumperR,
    intakeL, intakeR,
    diffuser, exhaustL, exhaustR,
    lowerPanel, stripeRoof, stripeHood,
    cabin, skirt,
    spoilerPostL, spoilerPostR, spoiler, plateL, plateR,
    headL, headR, headInnerL, headInnerR,
    tailL, tailR, glowPlane
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

  const headlights = [headL, headR, headInnerL, headInnerR];
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
  root.userData.plateL = plateL;
  root.userData.plateR = plateR;
  return root;
}
