import * as THREE from "three";

export function createMinimap(track, vehicle) {
  // Measure the full track extents so the orthographic camera fits it entirely
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of track.samples) {
    minX = Math.min(minX, s.position.x);
    maxX = Math.max(maxX, s.position.x);
    minZ = Math.min(minZ, s.position.z);
    maxZ = Math.max(maxZ, s.position.z);
  }
  const span = Math.max(maxX - minX, maxZ - minZ) * 0.58 + 80;

  const camera = new THREE.OrthographicCamera(-span, span, span, -span, 1, 600);
  camera.layers.set(1);

  const chevron = new THREE.Mesh(
    new THREE.ConeGeometry(18, 48, 3),
    new THREE.MeshBasicMaterial({ color: 0xff2d95, fog: false, depthTest: false })
  );
  chevron.rotation.x = -Math.PI / 2;
  chevron.layers.set(1);

  return { camera, chevron };
}

export function updateMinimap(minimap, vehicle) {
  const { camera, chevron } = minimap;
  const fx = Math.sin(vehicle.heading);
  const fz = Math.cos(vehicle.heading);
  // Camera stays directly overhead, rotates with player heading (heading-up)
  camera.position.set(vehicle.position.x, vehicle.position.y + 380, vehicle.position.z);
  camera.up.set(fx, 0, fz);
  camera.lookAt(vehicle.position.x, vehicle.position.y, vehicle.position.z);

  chevron.position.set(vehicle.position.x, vehicle.position.y + 2, vehicle.position.z);
  chevron.rotation.z = 0;
  chevron.rotation.y = vehicle.heading;
}

export function renderMinimap(renderer, scene, minimap, isMobile) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const size = isMobile ? 118 : 148;
  const margin = 16;
  const x = isMobile ? margin : w - size - margin;
  const y = h - size - margin;
  renderer.setScissorTest(true);
  renderer.setScissor(x, y, size, size);
  renderer.setViewport(x, y, size, size);
  renderer.render(scene, minimap.camera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  return { x, y, size };
}
