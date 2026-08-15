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
import { unlockAudio, announce, bindMute } from "./audio.js";
import { createTraffic, restyleTraffic, stepTraffic } from "./traffic.js";

export async function startGame(canvas) {
  const mobile = isMobileUi();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x0a0814, 1);

  const scene = new THREE.Scene();
  const camera = createChaseCamera();
  const track = createTrack();
  scene.add(track.group);
  scene.add(track.miniLine);
  createCity(scene, track);

  const start = track.samples[0];
  const heading = Math.atan2(start.tangent.x, start.tangent.z);
  const vehicle = createVehicle(start.position.clone().add(new THREE.Vector3(0, 0.38, 0)), heading);
  const car = await loadCar(scene);
  syncCarMesh(car, vehicle, 0.016);

  const traffic = createTraffic(scene, track, mobile ? 6 : 10);
  restyleTraffic(traffic, { name: "Harbor Cyan", bodyHex: "#14c8d4" });

  const minimap = createMinimap(track, vehicle);
  scene.add(minimap.chevron);

  const input = createControls();
  const hud = bindHud();
  bindMute();
  let mode = "garage";
  let liveryName = "Harbor Cyan";
  let lastLap = 0;
  let lastSpeedCall = 0;

  bindGarage({
    onLivery: (livery) => {
      applyLivery(car, livery);
      liveryName = livery.name || liveryName;
      restyleTraffic(traffic, livery);
    },
    onRace: () => {
      mode = "race";
      document.body.dataset.mode = "race";
      vehicle.lapTime = 0;
      vehicle.armed = false;
      vehicle.checkpoint = 0;
      lastLap = vehicle.lap;
      unlockAudio();
      announce("start", { livery: liveryName, kph: 0, lap: vehicle.lap });
    },
    onGarage: () => {
      mode = "garage";
      document.body.dataset.mode = "garage";
    },
  });

  applyLivery(car, {
    bodyHex: "#ff2d6a",
    lowerHex: "#2a0010",
    stripeHex: null,
    rimHex: "#d8dbe8",
    rimFinish: "chrome",
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
      if (consumeReset(input)) {
        resetVehicle(vehicle, track);
        announce("reset", { livery: liveryName, kph: 0, lap: vehicle.lap });
      }
      stepVehicle(vehicle, input, dt);
      constrainToTrack(track, vehicle, dt);
      vehicle.lapTime += dt;
      updateLaps(vehicle);
      if (vehicle.lap > lastLap) {
        lastLap = vehicle.lap;
        announce("lap", {
          livery: liveryName,
          kph: Math.abs(vehicle.speed) * 6.2,
          lap: vehicle.lap,
        });
      }
      const kph = Math.abs(vehicle.speed) * 6.2;
      if (kph > 210 && garageTime - lastSpeedCall > 9) {
        lastSpeedCall = garageTime;
        announce("speed", { livery: liveryName, kph, lap: vehicle.lap });
      }
      syncCarMesh(car, vehicle, dt);
      updateChaseCamera(camera, vehicle, dt, track);
      hud.update(vehicle);
    } else {
      syncCarMesh(car, vehicle, dt);
      updateGarageCamera(camera, car, garageTime);
    }

    stepTraffic(traffic, track, mode === "race" ? vehicle : null, dt);

    updateMinimap(minimap, vehicle);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
    renderMinimap(renderer, scene, minimap, mobile);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
