# Midnight City

Browser 3D arcade racer for the **AWS Weekend Creative Challenge**. NFS-style chase camera, a long night-city circuit, garage paint jobs, and an optional Amazon Bedrock (Nova) livery generator.

## Run (no AWS)

Needs **Node.js 20+**. From this folder:

```bash
npm install
npm run dev
```

Open **http://localhost:5173**.

**Live (AWS):** https://d13yfjiopq5e5t.cloudfront.net  
**Source:** https://github.com/Praneel7015/MidnightCity

| Key | Action |
| --- | --- |
| W / ↑ | Throttle |
| S / ↓ | Reverse |
| A D / ← → | Steer |
| Space | Brake |
| R | Reset to track |

On a phone, on-screen GAS / BRAKE / steer pads appear. Buildings never collide with the car. If you sit against a rail, the car auto-nudges back to the racing line.

`npm run dry-run` builds the game and smoke-checks the track/assets.

## Optional: AI paint jobs

```bash
npm run api
```

That starts a local API on `http://localhost:3001` (needs AWS credentials + Bedrock Nova Micro access). The garage **AI Paint Job** button also works against the deployed API after CDK. Without it, color presets still apply.

## Deploy to AWS

See [docs/DEPLOY_CHECKLIST.md](docs/DEPLOY_CHECKLIST.md). Short version: `cdk deploy` in `infra/`, then build the frontend with `VITE_API_URL` and sync `frontend/dist` to the stack’s S3 bucket.

## Article

Draft: [docs/ARTICLE.md](docs/ARTICLE.md) — title **Weekend Creative Challenge: Midnight City**, tag `#creative-expression`.
