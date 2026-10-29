export type PaymentEvent = {
  amount: number;
  currency: string;
  beneficiary: string;
};

export type SessionDecision = "allow" | "step_up";

export function decidePayment(event: PaymentEvent, sessionRotated: boolean): SessionDecision {
  if (!sessionRotated || event.amount > 10000) return "step_up";
  return "allow";
}
