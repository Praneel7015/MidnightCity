import * as THREE from "three";

export function makeAsphaltTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#7a7f8c";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const n = 70 + Math.floor(Math.random() * 40);
    g.fillStyle = `rgb(${n},${n},${n + 6})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = "#e8e2b8";
  g.lineWidth = 8;
  g.setLineDash([28, 22]);
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, 256);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = "#d0d4de";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(14, 0);
  g.lineTo(14, 256);
  g.moveTo(242, 0);
  g.lineTo(242, 256);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
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
  c.width = 1024;
  c.height = 512;
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

  for (let i = 0; i < 350; i++) {
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
