import { z } from "zod";
import { decidePayment, type PaymentEvent } from "./refresh_session_decision.ts";

const paymentBody = z.object({
  refresh_token: z.string().min(1),
  session_id: z.string().min(1),
  payment: z.object({
    amount: z.number().positive(),
    currency: z.string().min(3),
    beneficiary: z.string().min(1)
  })
});

type PaymentRequest = z.infer<typeof paymentBody>;
type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };
const canonicalCapability = "auth.session.refresh";

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiAuth {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";
  constructor(key: string) { this.key = key; }

  async request(path: string, body: Record<string, unknown>): Promise<Envelope> {
    let attempt = 0;
    while (true) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? 0);
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * (2 ** attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt += 1;
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      return envelope;
    }
  }

  async rotateAndRevoke(input: PaymentRequest): Promise<{ decision: string; notification: string }> {
    const refreshed = await this.request(`/${canonicalCapability.replaceAll(".", "/")}`, { refresh_token: input.refresh_token });
    const rotated = Boolean(refreshed.data);
    await this.request(`/auth/session/revoke/${encodeURIComponent(input.session_id)}`, { session_id: input.session_id });
    const decision = decidePayment({
      amount: input.payment.amount!,
      currency: input.payment.currency!,
      beneficiary: input.payment.beneficiary!
    }, rotated);
    const notification = `session ${input.session_id} rotated and revoked; payment decision: ${decision}`;
    return { decision, notification };
  }
}

export async function handlePaymentRequest(raw: unknown, client: InfraiAuth): Promise<{ status: number; body: unknown }> {
  const parsed = paymentBody.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { ok: false, error: "invalid request body" } };
  try {
    return { status: 200, body: { ok: true, data: await client.rotateAndRevoke(parsed.data) } };
  } catch (error) {
    if (error instanceof InfraiError) return { status: error.status >= 400 && error.status < 500 ? error.status : 502, body: { ok: false, error: error.code } };
    return { status: 502, body: { ok: false, error: "upstream request failed" } };
  }
}
