import * as THREE from "three";
import { createTrack, constrainToTrack } from "./track.js";
import {
  loadCar,
  createVehicle,
  stepVehicle,
  syncCarMesh,
  applyLivery,
  resetVehicle,
  updateLaps,
} from "./car.js";
import { createChaseCamera, updateChaseCamera, updateGarageCamera, resizeCamera } from "./camera.js";
import { createCity } from "./city.js";
import { createMinimap, updateMinimap, renderMinimap } from "./minimap.js";
import { createControls, consumeReset, isMobileUi } from "./controls.js";
import { bindGarage } from "../ui/garage.js";
import { bindHud } from "../ui/hud.js";

export async function startGame(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x0a0814, 1);

  const scene = new THREE.Scene();
  const camera = createChaseCamera();
  const loader = new THREE.TextureLoader();
  const track = createTrack(loader);
  scene.add(track.group);
  scene.add(track.miniLine);
  createCity(scene, track);

  const start = track.samples[0];
  const heading = Math.atan2(start.tangent.x, start.tangent.z);
  const vehicle = createVehicle(start.position.clone().add(new THREE.Vector3(0, 0.38, 0)), heading);
  const car = await loadCar(scene);
  syncCarMesh(car, vehicle, 0.016);

  const minimap = createMinimap(track, vehicle);
  scene.add(minimap.chevron);

  const input = createControls();
  const hud = bindHud();
  let mode = "garage";

  bindGarage({
    onLivery: (livery) => applyLivery(car, livery),
    onRace: () => {
      mode = "race";
      document.body.dataset.mode = "race";
      vehicle.lapTime = 0;
      vehicle.armed = false;
      vehicle.checkpoint = 0;
    },
    onGarage: () => {
      mode = "garage";
      document.body.dataset.mode = "garage";
    },
  });

  applyLivery(car, {
    bodyHex: "#ff2d6a",
    rimHex: "#d8dbe8",
    glowHex: "#3df0ff",
    spoiler: true,
    headlights: true,
  });

  function onResize() {
    resizeCamera(camera, renderer);
  }
  window.addEventListener("resize", onResize);
  onResize();

  const clock = new THREE.Clock();
  let garageTime = 0;

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    garageTime += dt;

    if (mode === "race") {
      if (consumeReset(input)) resetVehicle(vehicle, track);
      stepVehicle(vehicle, input, dt);
      constrainToTrack(track, vehicle, dt);
      vehicle.lapTime += dt;
      updateLaps(vehicle);
      syncCarMesh(car, vehicle, dt);
      updateChaseCamera(camera, vehicle, dt);
      hud.update(vehicle);
    } else {
      syncCarMesh(car, vehicle, dt);
      updateGarageCamera(camera, car, garageTime);
    }

    updateMinimap(minimap, vehicle);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
    renderMinimap(renderer, scene, minimap, isMobileUi());
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
