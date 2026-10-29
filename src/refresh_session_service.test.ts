import assert from "node:assert/strict";
import { decidePayment } from "./refresh_session_decision.ts";

const payment = { amount: 120, currency: "USD", beneficiary: "merchant-7" };
assert.equal(decidePayment(payment, true), "allow");
assert.equal(decidePayment(payment, false), "step_up");
assert.equal(decidePayment({ ...payment, amount: 10001 }, true), "step_up");
console.log("payment decision test passed");
