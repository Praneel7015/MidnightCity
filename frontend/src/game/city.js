import * as THREE from "three";
import { ROAD_HALF_WIDTH } from "./trackData.js";
import { makeSkyTexture, makeWindowTexture } from "./textures.js";

export function createCity(scene, track) {
  const skyTex = makeSkyTexture();
  scene.background = skyTex;
  scene.environment = skyTex;
  scene.fog = new THREE.FogExp2(0x1a1230, 0.00042);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(sky);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1800, 48),
    new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0x6a7ec8, 0x1a1020, 0.7));
  const moon = new THREE.DirectionalLight(0xc8d8ff, 0.85);
  moon.position.set(-80, 140, 40);
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x223044, 0.35));

  const windowTex = makeWindowTexture();
  const buildingMat = new THREE.MeshStandardMaterial({
    map: windowTex,
    emissiveMap: windowTex,
    emissive: 0xffc878,
    emissiveIntensity: 0.55,
    roughness: 0.85,
    metalness: 0.15,
    color: 0x8899aa,
  });

  placeRingBuildings(scene, track, buildingMat, 1);
  placeRingBuildings(scene, track, buildingMat, -1);
  placeDowntown(scene, track, buildingMat);
  placeLamps(scene, track);

  return { sky };
}

function placeRingBuildings(scene, track, mat, sign) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const count = 90;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  let i = 0;
  const step = Math.floor(track.samples.length / count);
  for (let s = 0; s < track.samples.length && i < count; s += step) {
    const sample = track.samples[s];
    const clearance = ROAD_HALF_WIDTH + 22 + (s % 7) * 3;
    dummy.position.copy(sample.position).addScaledVector(sample.right, sign * clearance);
    dummy.position.y = 0;
    const h = 14 + ((s * 13) % 38);
    const w = 8 + (s % 5) * 1.5;
    const d = 8 + ((s * 3) % 6);
    dummy.scale.set(w, h, d);
    dummy.lookAt(sample.position.x, dummy.position.y, sample.position.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    i++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = i;
  scene.add(mesh);
}

function placeDowntown(scene, track, mat) {
  let cx = 0;
  let cz = 0;
  for (const s of track.samples) {
    cx += s.position.x;
    cz += s.position.z;
  }
  cx /= track.samples.length;
  cz /= track.samples.length;

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const count = 48;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = 40 + (i % 6) * 18;
    dummy.position.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
    dummy.scale.set(10 + (i % 4) * 3, 22 + (i * 17) % 55, 10 + (i % 3) * 3);
    dummy.rotation.y = a * 0.2;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mesh);
}

function placeLamps(scene, track) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22222c, roughness: 0.6 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe6b0,
    emissive: 0xffd48a,
    emissiveIntensity: 1.3,
  });
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.2, 6);
  const bulbGeo = new THREE.SphereGeometry(0.22, 8, 8);

  let lights = 0;
  for (let i = 0; i < track.samples.length; i += 14) {
    const s = track.samples[i];
    const side = i % 28 === 0 ? 1 : -1;
    const pos = s.position.clone().addScaledVector(s.right, side * (ROAD_HALF_WIDTH + 2.8));
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.copy(pos);
    pole.position.y += 3.1;
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.copy(pos);
    bulb.position.y += 6.2;
    scene.add(pole, bulb);

    if (lights < 8) {
      const pl = new THREE.PointLight(0xffd8a0, 3.2, 48, 2);
      pl.position.copy(bulb.position);
      scene.add(pl);
      lights++;
    }
  }
}
