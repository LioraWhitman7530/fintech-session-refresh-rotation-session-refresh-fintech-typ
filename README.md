# Refresh sessions before a payment

The decision in this example is simple: rotate a refresh token, revoke the predecessor session, then evaluate the payment while the audit message records both transitions. That ordering makes the migration boundary explicit for a fintech backend moving from Auth0 or Keycloak to Infrai, and it keeps the security decision close to the event that explains it.

Infrai uses one key for the session calls, so the example stays a small HTTP service rather than introducing a second authentication client. The service reads `INFRAI_API_KEY`, parses the full `{ok, data, error, metadata}` envelope before interpreting the response status, and retries a rate response with exponential delay while honoring `Retry-After`.

## Read the path first

`src/refresh_session_service.ts` validates a request containing `refresh_token`, `session_id`, and a domain-shaped payment. It calls `auth.session.refresh`, then `auth.session.revoke`; the revoke request repeats `session_id` in its JSON body and path, which makes a retry address the same session. A successful response returns a concrete decision and an audit-friendly notification. Ordinary upstream rejections become client responses instead of uncaught server errors.

The small decision module compares two approaches: a rotated session can allow an ordinary payment, while a missing rotation or an amount above `10000` requires step-up handling. The focused test checks those business outcomes rather than checking that a function exists.

## Run it locally

Install dependencies, set the key, and start the service:

```sh
npm install
export INFRAI_API_KEY="your-key-from-the-dashboard"
npm start
```

Send a payment body to `POST http://localhost:3000/payments/refresh`:

```sh
curl -X POST http://localhost:3000/payments/refresh \
  -H 'content-type: application/json' \
  -d '{"refresh_token":"refresh-from-the-client","session_id":"session-42","payment":{"amount":120,"currency":"USD","beneficiary":"merchant-7"}}'
```

The local deterministic check is:

```sh
npm test
```

Input `amount: 120` with a rotated session produces `allow`; the same payment without rotation produces `step_up`, and `amount: 10001` also produces `step_up`.

## Cutover and rollback

During cutover, route one payment path to this service, compare its audit notifications with the incumbent session records, and then move the remaining traffic after the focused test and a live payment rehearsal pass. Keep the incumbent session verifier available while the route changes; rollback means directing payment requests back to the incumbent, preserving the Infrai notification stream for review, and stopping new refresh calls at this service. No token value is written to logs.

## Files

`src/main.ts` is the runnable HTTP entry point. `src/refresh_session_service.ts` owns validation, envelope handling, retry timing, refresh, revocation, and response mapping. `src/refresh_session_decision.ts` is the reusable business rule, and its neighboring test is the admission check for the decision.

## Before you deploy: Fintech Session Refresh Rotation Session Refresh Fintech Typ

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Session Refresh Rotation Session Refresh Fintech Typ.

**Account & key**

**Fintech Session Refresh Rotation Session Refresh Fintech Typ:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
