# Deploy Checklist

Play the game locally first (`npm run dry-run` then `npm run dev`). AWS is only for the public URL and live Nova liveries.

## 1. One-time

- AWS CLI configured (`aws sts get-caller-identity` works)
- Node 20+
- Region: `us-east-1` (same as WeekAhead)
- Bedrock console → Model access → Amazon Nova Micro (APAC inference profile `apac.amazon.nova-micro-v1:0`)
- `cd infra && npm install && npx cdk bootstrap` (once per account/region)

## 2. Deploy API + hosting

```bash
cd infra
npm install
npx cdk deploy
```

Note outputs: `ApiUrl`, `FrontendBucketName`, `CloudFrontDomain`, `CloudFrontDistributionId`.

## 3. Build and upload the game

```bash
cd ../frontend
echo VITE_API_URL=<ApiUrl from step 2> > .env.production
npm install
npm run build
aws s3 sync dist/ s3://<FrontendBucketName> --delete
aws cloudfront create-invalidation --distribution-id <CloudFrontDistributionId> --paths "/*"
```

Live game: `https://<CloudFrontDomain>`

## 4. Smoke

- Open the CloudFront URL on a laptop: garage visible, Drop In, WASD, minimap updates
- Phone or DevTools mobile: touch pads appear, car still steers
- Garage → AI Paint Job changes the body color (or falls back to a preset if Nova is off)

## 5. Article

Paste [docs/ARTICLE.md](ARTICLE.md) to AWS Builder Center **after** Fri 14 Aug 2026, 12:30 PM IST. Title must be `Weekend Creative Challenge: Midnight City`. Tag: `creative-expression`.
