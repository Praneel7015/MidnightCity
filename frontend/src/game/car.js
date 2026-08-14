import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { checkpointCount } from "./trackData.js";

export const MAX_SPEED = 36;
export const REVERSE_MAX = 12;
const ACCEL = 22;
const BRAKE = 42;
const REVERSE_ACCEL = 16;
const COAST = 7;
const STEER_RATE = 2.15;

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
  if (livery.rimHex && mats.rim) {
    mats.rim.color.set(livery.rimHex);
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

export async function loadCar(scene) {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync("/assets/car.glb");
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    root.position.sub(center);
    root.position.y -= box.min.y;
    const targetLen = 4.4;
    const s = targetLen / Math.max(size.z, size.x, 0.001);
    root.scale.setScalar(s);

    let bodyMat = null;
    root.traverse((o) => {
      if (o.isMesh && o.material && o.material.color && !bodyMat) {
        bodyMat = o.material;
        if (Array.isArray(bodyMat)) bodyMat = bodyMat[0];
      }
    });
    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.userData.materials = {
      body: bodyMat || new THREE.MeshStandardMaterial({ color: 0xff2d6a }),
      rim: bodyMat,
      glow: bodyMat,
    };
    wrapper.userData.wheels = [];
    wrapper.userData.frontWheels = [];
    addUnderglow(wrapper);
    scene.add(wrapper);
    return wrapper;
  } catch {
    const car = createProceduralCar();
    scene.add(car);
    return car;
  }
}

export function createProceduralCar() {
  const root = new THREE.Group();
  root.name = "car";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x14c8d4,
    metalness: 0.38,
    roughness: 0.42,
    envMapIntensity: 0.85,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    metalness: 0.4,
    roughness: 0.5,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8ecbff,
    metalness: 0.9,
    roughness: 0.05,
    transparent: true,
    opacity: 0.35,
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

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.52, 4.35), bodyMat);
  body.position.y = 0.58;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.28, 0.7), bodyMat);
  nose.position.set(0, 0.48, 2.35);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.48, 1.85), glassMat);
  cabin.position.set(0, 1.05, -0.15);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.5), bodyMat);
  roof.position.set(0, 1.32, -0.2);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.12, 3.6), darkMat);
  skirt.position.y = 0.32;

  const spoilerPostL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), darkMat);
  spoilerPostL.position.set(-0.55, 1.05, -1.95);
  const spoilerPostR = spoilerPostL.clone();
  spoilerPostR.position.x = 0.55;
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.42), bodyMat);
  spoiler.position.set(0, 1.22, -1.95);

  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), headMat);
  headL.position.set(-0.58, 0.55, 2.68);
  const headR = headL.clone();
  headR.position.x = 0.58;
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), tailMat);
  tailL.position.set(-0.6, 0.58, -2.18);
  const tailR = tailL.clone();
  tailR.position.x = 0.6;

  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.6), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.08;

  root.add(body, nose, cabin, roof, skirt, spoilerPostL, spoilerPostR, spoiler, headL, headR, tailL, tailR, glowPlane);

  const wheels = [];
  const frontWheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  function makeWheel(x, z, front) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.38, z);
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), rimMat);
    rim.rotation.z = Math.PI / 2;
    pivot.add(tire, rim);
    root.add(pivot);
    wheels.push(tire);
    if (front) frontWheels.push(tire);
    return pivot;
  }
  makeWheel(-0.92, 1.35, true);
  makeWheel(0.92, 1.35, true);
  makeWheel(-0.92, -1.4, false);
  makeWheel(0.92, -1.4, false);

  const glowLight = new THREE.PointLight(0x3df0ff, 4, 9, 2);
  glowLight.position.set(0, 0.2, 0);
  root.add(glowLight);

  const spotL = new THREE.SpotLight(0xfff2d0, 6, 42, 0.35, 0.4, 1.4);
  spotL.position.set(-0.5, 0.6, 2.4);
  spotL.target.position.set(-0.5, 0.2, 16);
  const spotR = spotL.clone();
  spotR.position.x = 0.5;
  spotR.target.position.set(0.5, 0.2, 16);
  root.add(spotL, spotL.target, spotR, spotR.target);

  root.userData.materials = { body: bodyMat, rim: rimMat, glow: glowMat };
  root.userData.spoiler = spoiler;
  root.userData.wheels = wheels;
  root.userData.frontWheels = frontWheels;
  root.userData.glowLight = glowLight;
  root.userData.headlights = [spotL, spotR, headL, headR];
  return root;
}

function addUnderglow(wrapper) {
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x3df0ff,
    emissive: 0x3df0ff,
    emissiveIntensity: 0.9,
  });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.1;
  const glowLight = new THREE.PointLight(0x3df0ff, 4, 9, 2);
  glowLight.position.set(0, 0.2, 0);
  wrapper.add(glowPlane, glowLight);
  wrapper.userData.materials.glow = glowMat;
  wrapper.userData.glowLight = glowLight;
  wrapper.userData.spoiler = wrapper.userData.spoiler || wrapper;
}
