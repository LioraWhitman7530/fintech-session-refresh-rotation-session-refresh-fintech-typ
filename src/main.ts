import { createServer } from "node:http";
import { InfraiAuth, handlePaymentRequest } from "./refresh_session_service.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");
const client = new InfraiAuth(key);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/payments/refresh") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not found" }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  let raw: unknown;
  try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { raw = null; }
  const result = await handlePaymentRequest(raw, client);
  response.writeHead(result.status, { "content-type": "application/json" });
  response.end(JSON.stringify(result.body));
}).listen(3000, () => console.log("payment refresh service listening on http://localhost:3000"));
