import * as THREE from "three";

export function makeAsphaltTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#1a1a22";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const n = 18 + Math.floor(Math.random() * 22);
    g.fillStyle = `rgb(${n},${n},${n + 4})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  g.strokeStyle = "rgba(230,230,210,0.85)";
  g.lineWidth = 10;
  g.setLineDash([42, 36]);
  g.beginPath();
  g.moveTo(256, 0);
  g.lineTo(256, 512);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#0b0c14";
  g.fillRect(0, 0, 256, 512);
  for (let y = 16; y < 500; y += 22) {
    for (let x = 10; x < 246; x += 18) {
      if (Math.random() < 0.38) continue;
      const warm = Math.random() > 0.35;
      g.fillStyle = warm
        ? `rgba(255, ${180 + Math.random() * 50}, 90, ${0.55 + Math.random() * 0.4})`
        : `rgba(120, 210, 255, ${0.35 + Math.random() * 0.4})`;
      g.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSkyTexture() {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, "#02010a");
  grd.addColorStop(0.42, "#081028");
  grd.addColorStop(0.58, "#16103a");
  grd.addColorStop(0.72, "#4a1848");
  grd.addColorStop(0.86, "#d2652a");
  grd.addColorStop(0.94, "#6a2830");
  grd.addColorStop(1, "#120810");
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 900; i++) {
    const y = Math.random() * c.height * 0.58;
    const x = Math.random() * c.width;
    const s = Math.random() * 1.7 + 0.4;
    g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.75})`;
    g.beginPath();
    g.arc(x, y, s, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

export function makeChevronsTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#111118";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#f5f0c8";
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    const x = i * 32;
    g.moveTo(x + 4, 8);
    g.lineTo(x + 20, 32);
    g.lineTo(x + 4, 56);
    g.lineTo(x + 12, 56);
    g.lineTo(x + 28, 32);
    g.lineTo(x + 12, 8);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
