import * as THREE from "three";
import { ROAD_HALF_WIDTH } from "./trackData.js";
import { makeSkyTexture, makeWindowTexture } from "./textures.js";

export function createCity(scene, track) {
  const skyTex = makeSkyTexture();
  scene.background = skyTex;
  scene.fog = new THREE.FogExp2(0x0d0820, 0.00022);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 16, 10),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  scene.add(sky);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1800, 24),
    new THREE.MeshLambertMaterial({
      color: 0x16141f,
      side: THREE.DoubleSide,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0x6a7ec8, 0x1a1020, 0.85));
  const moon = new THREE.DirectionalLight(0xc8d8ff, 1.05);
  moon.position.set(-80, 140, 40);
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x334466, 0.55));

  const windowTex = makeWindowTexture();
  const buildingMat = new THREE.MeshLambertMaterial({
    map: windowTex,
    emissiveMap: windowTex,
    emissive: 0xffc878,
    emissiveIntensity: 0.55,
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
  const count = 40;
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
  const count = 24;
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
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22222c });
  const bulbMat = new THREE.MeshLambertMaterial({
    color: 0xffe6b0,
    emissive: 0xffd48a,
    emissiveIntensity: 1.2,
  });
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.2, 5);
  const bulbGeo = new THREE.SphereGeometry(0.22, 6, 6);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 24);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 24);
  const dummy = new THREE.Object3D();
  let i = 0;
  const step = Math.max(1, Math.floor(track.samples.length / 24));
  for (let s = 0; s < track.samples.length && i < 24; s += step) {
    const sample = track.samples[s];
    const side = i % 2 === 0 ? 1 : -1;
    dummy.position.copy(sample.position).addScaledVector(sample.right, side * (ROAD_HALF_WIDTH + 2.8));
    dummy.position.y += 3.1;
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 3.1;
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
    if (i < 4) {
      const pl = new THREE.PointLight(0xffd8a0, 2.4, 40, 2);
      pl.position.copy(dummy.position);
      scene.add(pl);
    }
    i++;
  }
  poles.count = i;
  bulbs.count = i;
  scene.add(poles, bulbs);
}
