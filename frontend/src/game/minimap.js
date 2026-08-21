import * as THREE from "three";

export function createMinimap(track, vehicle) {
  // Measure full track extents to fit the entire circuit in view
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of track.samples) {
    minX = Math.min(minX, s.position.x);
    maxX = Math.max(maxX, s.position.x);
    minZ = Math.min(minZ, s.position.z);
    maxZ = Math.max(maxZ, s.position.z);
  }

  // Span = half the diagonal + padding so the full circuit fits with breathing room
  const span = Math.sqrt((maxX - minX) ** 2 + (maxZ - minZ) ** 2) / 2 + 80;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const camera = new THREE.OrthographicCamera(-span, span, span, -span, 1, 600);
  // Static north-up overhead shot centred on the circuit — never moves
  camera.position.set(cx, 400, cz);
  camera.lookAt(cx, 0, cz);
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
  // Camera is static — only the player chevron moves around the circuit
  const { chevron } = minimap;
  chevron.position.set(vehicle.position.x, vehicle.position.y + 2, vehicle.position.z);
  chevron.rotation.z = 0;
  chevron.rotation.y = vehicle.heading;
}

export function renderMinimap(renderer, scene, minimap, isMobile) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const size   = isMobile ? 100 : 148;
  const margin = isMobile ? 8 : 16;
  const x = w - size - margin;  // always top-right
  const y = h - size - margin;
  renderer.setScissorTest(true);
  renderer.setScissor(x, y, size, size);
  renderer.setViewport(x, y, size, size);
  renderer.render(scene, minimap.camera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  return { x, y, size };
}
