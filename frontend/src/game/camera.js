import * as THREE from "three";

export function createChaseCamera() {
  const camera = new THREE.PerspectiveCamera(62, 1, 0.45, 2800);
  camera.position.set(0, 6, -12);
  return camera;
}

export function updateChaseCamera(camera, vehicle, dt, track) {
  const fx = Math.sin(vehicle.heading);
  const fz = Math.cos(vehicle.heading);
  const rx = Math.cos(vehicle.heading);
  const rz = -Math.sin(vehicle.heading);
  const speedRatio = Math.min(Math.abs(vehicle.speed) / 58, 1);
  const back = 8.2 + speedRatio * 4;
  const height = 3.35 + speedRatio * 0.6;
  const look = 12 + speedRatio * 6;
  const lean = vehicle.steer * 1.1;

  let camY = vehicle.position.y + height;
  if (track?.samples?.length) {
    const n = track.samples.length;
    const behind = Math.round(back / 14);
    const sample = track.samples[(((vehicle.sampleIndex || 0) - behind) % n + n) % n];
    camY = Math.max(camY, sample.position.y + height * 0.85);
  }

  const desired = new THREE.Vector3(
    vehicle.position.x - fx * back + rx * lean,
    camY,
    vehicle.position.z - fz * back + rz * lean
  );
  const alpha = 1 - Math.exp(-dt * 7.5);
  camera.position.lerp(desired, alpha);

  const target = new THREE.Vector3(
    vehicle.position.x + fx * look,
    vehicle.position.y + 0.85,
    vehicle.position.z + fz * look
  );
  camera.lookAt(target);
}

export function updateGarageCamera(camera, car, time) {
  const r = 7.2;
  const a = time * 0.35;
  camera.position.set(
    car.position.x + Math.cos(a) * r,
    car.position.y + 2.6,
    car.position.z + Math.sin(a) * r
  );
  camera.lookAt(car.position.x, car.position.y + 0.7, car.position.z);
}

export function resizeCamera(camera, renderer) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
