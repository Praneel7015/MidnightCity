# Credits & licenses

Midnight City vendors free textures and generates the rest at runtime so the game never depends on a live CDN.

## Poly Haven — asphalt_02 (CC0)

- File: `frontend/public/assets/asphalt_02_diff_1k.jpg`
- Source: https://polyhaven.com/a/asphalt_02
- License: CC0 1.0 (public domain)
- Used as the optional road albedo. If the file is missing, a canvas asphalt texture is used instead.

## Kevin MacLeod — Take the Lead (CC BY 3.0)

- File: `frontend/public/assets/music/race.mp3`
- Artist: Kevin MacLeod (https://incompetech.com)
- Track: *Take the Lead*
- License: Creative Commons Attribution 3.0 (https://creativecommons.org/licenses/by/3.0/)
- Used as looping in-game racing music. Starts on **Drop In** (browser autoplay rules).

## Original game content (this repo)

Track spline, neon kerbs, tunnel, instanced city buildings, procedural sports car, night skybox (canvas equirectangular gradient + stars), chase camera, minimap, and UI are original to Midnight City. Treat them as CC0 for this challenge.

## Software

- [Three.js](https://threejs.org/) — MIT
- [Vite](https://vitejs.dev/) — MIT
- Amazon Bedrock Nova Micro — garage AI paint jobs and spoken race commentary

Kenney.nl Car Kit (CC0) was intended as the hero GLB. Their site does not expose a stable raw URL from this environment, so the racer ships a procedural coupe plus a GLTF loader fallback (`/assets/car.glb` if you drop one in).
