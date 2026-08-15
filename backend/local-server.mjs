import express from "express";
import cors from "cors";
import { handler } from "./lambdas/livery/index.mjs";

const app = express();
app.use(cors());
app.use(express.json());

async function proxy(req, res) {
  const event = {
    httpMethod: req.method,
    requestContext: { http: { method: req.method, path: req.path } },
    rawPath: req.path,
    path: req.path,
    body: JSON.stringify(req.body || {}),
  };
  const out = await handler(event);
  res.status(out.statusCode);
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  if (out.body) res.send(out.body);
  else res.end();
}

app.options("/livery", proxy);
app.get("/livery", proxy);
app.post("/livery", proxy);
app.options("/commentary", proxy);
app.get("/commentary", proxy);
app.post("/commentary", proxy);
app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Midnight City API on http://localhost:${port}`);
});
