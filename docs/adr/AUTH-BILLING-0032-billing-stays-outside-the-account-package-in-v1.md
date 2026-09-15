# ADR-AUTH-BILLING-0032: Billing Stays Outside the Account Package in V1

Date: 2026-09-15

## Status

Proposed

## Context

The Workshop site (`apps/website`) tops up credits by calling Cloud's
`/api/billing/topup/checkout` and exchanging the response for a hosted
Stripe checkout URL. It reaches that endpoint through its own module,
`apps/website/src/lib/workshop/buy-credits.ts`, and lists workspaces
through `apps/website/src/lib/workshop/workspaces.ts` — both plain
`fetch` calls with their own Zod response validation. The cloud app
reaches billing and workspaces through one axios client,
`src/platform/workspace/api/workspaceApi.ts` — `getBillingStatus`,
`subscribe`, `resubscribe`, `list` — and that client carries
`attachUnifiedRemintInterceptor`, so production's re-mint behaviour
lives in `src/platform/auth/unified/remintRetry.ts`.

`createSessionBillingTransport` in
`packages/account/src/core/billing/transport.ts` became a second
production path hours before this ADR was written. #17665 landed on
2026-09-15 and routes the cloud app's top-up through it behind
`billing_sdk_topup_enabled`, reached from `useTopupOperation.ts` and
`useWorkspaceBilling.ts` by way of
`src/platform/workspace/billing/sdk/createBillingSdk.ts`. Until then
its only callers outside its own definition and re-export were tests.
That matters for how the cost below is counted — the shared transport
is no longer a designed replacement awaiting its first production
caller, so the site is now the surface declining a path the cloud app
already exercises.

This split was not an oversight, but until now it was recorded only in
two source-file header comments
(`apps/website/src/config/workshop-balance.ts` and
`workshop-credits.ts`), both of which state that "billing stays outside
`@comfyorg/account` in V1". A meeting on 11 Sep 2026 agreed that the
arrangement should be written up for the people who were not in the
room; that write-up did not happen, and its absence is what this ADR
corrects.

Three facts bound the decision.

**The account package's payment commands did not exist.** The billing
half of `@comfyorg/account` shipped its read paths first — credits,
capabilities, status — and `index.ts` says the payment commands "land
on top of these same contracts", which they do in FE-2214 (#17657),
still open. A top-up flow built against the package in the week of
11 Sep would have had to build that command layer first.

**The transport did exist.** `createSessionBillingTransport` was
already on `main`, `apps/website` already depended on
`@comfyorg/account`, and `BillingRequest` is generic over method,
route, and body — its own contract comment uses `/billing/topup` as the
example route. The site could have carried its top-up POST over the
shared transport without the command layer. It did not, because the V1
boundary put billing outside the package altogether rather than
case-by-case.

**Session handling was never in scope for the split.** Both site call
sites run on the shared `SessionClient`. `tokenForCheckout` in
`BuyCreditsDialog.vue` awaits `ensureFresh({ workspaceId })`
immediately before the POST and validates uid and workspace against a
scope captured at attempt start; after the response,
`requireCurrentCheckoutScope` rejects a result that arrived once the
session moved. `HeaderAccount.vue` does the same around
`listWorkspaces` (`ensureFresh` → `sameSessionScope` → call →
`workspaceLoadIsOwned`). That is the freshness strategy
`packages/account/src/core/session.ts` specifies for every host:
valid-on-read, where "callers await `ensureFresh` at the moment they
need a token; it never resolves with a stale one".

The immediate driver was a launch blocker: a shipped page offered no
way to add credits, and the fastest unblock was Cloud's standalone
top-up endpoint called directly from the site.

## Decision

1. **For V1, the Workshop site owns its billing transport.** Top-up
   and workspace-list requests from `apps/website` go through the
   site's own modules rather than `createSessionBillingTransport` or
   `workspaceApi.ts`. The boundary is the billing transport only.

2. **Identity and session stay shared.** The site binds identity
   through the package's Firebase entry and mints through the shared
   `SessionClient`. No local credential cache, no second mint path, no
   local token-freshness rule. Any caller needing a token awaits
   `ensureFresh` at the moment of use, per ADR-AUTH-IDENTITY-0028 and
   the valid-on-read contract in `session.ts`.

3. **Scope guards are mandatory at every site call site.** A billing
   or workspace request captures uid and workspace id before its first
   `await`, and rejects a response that arrives after either changed.
   This is the site's stand-in for the transport's `SUPERSEDED`
   result, and it is not optional: without it a response can be
   attributed to the wrong account. The checkout and workspace-list
   call sites compare workspace id explicitly. The balance reader in
   `workshop-balance.ts` does not: `runRefresh()` captures uid and
   token, and its publish guard compares those two. Because the
   credential is a workspace-scoped JWT, token equality stands in for
   workspace equality there — but `AccountCredential` carries `token`
   and `workspace` separately and nothing in the session contract
   forces them to move together, so that reader relies on a property
   of the mint rather than on this rule. New call sites take the
   explicit comparison; aligning the balance reader is a separate
   change against a hardened path, not a docs edit.

4. **No new local copies.** This ADR authorizes exactly the two
   existing modules. Further billing surfaces — subscriptions,
   embedded checkout, retention — do not get a site-local
   implementation under it; they wait for the shared command layer.
   Nothing enforces this mechanically. `CODEOWNERS` has no entry for
   these paths, and `.github/workflows/ci-pr-risk.yml` is advisory by
   construction, so a change can land against this rule without any
   check objecting. Until the entries exist the rule is convention,
   and the consequence below is what would turn it into a gate.

5. **The boundary retires on convergence.** The shared top-up command
   (#17657) landed on 2026-09-15, so what remains is `buy-credits.ts`
   moving onto it and ceasing to be a separate implementation. That
   convergence is the condition for closing this ADR, not a follow-up
   to schedule later, and as of this date it is the only part of the
   closing condition still outstanding.

### Revisit trigger

Rule 5 closes this ADR on convergence, and like rule 4 that has no
owner. #17657 landed on 2026-09-15, so the event rule 5 waits on is no
longer the one at risk; what is outstanding is the convergence work
itself, and nothing schedules it. **If `buy-credits.ts` has not
converged onto the shared top-up command by 2026-10-15, this ADR is
re-decided rather than extended** — either the boundary is re-affirmed
with a new date and a named owner, or convergence is scheduled as
committed work.

The date is a backstop, not an estimate of that work. It is worth
having because the site's exposure moves independently of this
document: as of this date `topup_checkout_enabled` is at 100% within an
`email ends_with @comfy.org` filter, so the unhandled 401 under the
residual-401 consequence reaches employees only — but that filter was
removed and restored within ten minutes on 15 Sep 2026. Widening it to
customer payments is a flag edit that touches nothing this ADR
governs.

## Alternatives Considered

- **Wait for the billing SDK's command layer.** Rejected at the time:
  the command layer was not built, and the page had already shipped
  without a way to buy credits. This remains the correct end state —
  rule 5 is that state, dated rather than deferred.

- **Carry the top-up POST over `createSessionBillingTransport` without
  the command layer.** Available, and cheaper than it looked: the
  transport is generic over route and body, and the site already
  depended on the package. Not taken, because V1 drew the boundary at
  "billing" rather than at "billing commands". Had it been taken, the
  401 re-mint described under the residual-401 consequence would have
  been available — subject to the key mapping in the replay-safety
  consequence — and the site would have been the transport's first
  production caller — which is also why not taking it is a weaker
  error than it first looks: no production surface was using it to
  diverge from. This is still the part of the decision least worth
  repeating.

- **Route the site's top-up through the cloud app.** Rejected: it
  reintroduces the failure the endpoint was built to avoid, where a
  user with clear intent to buy credits is redirected to another
  property and a billing rail that may not apply to them.

## Consequences

- **One rule, two live copies and a third in waiting.** The
  single-forced-re-mint rule runs in production in the cloud app's
  `attachUnifiedRemintInterceptor`
  (`src/platform/auth/unified/remintRetry.ts`, attached to both
  `workspaceApi` and `customerEventsService`) and in the site's
  balance reader, which names itself "the site's own copy of that
  rule". It is implemented a third time in `transport.ts`, which
  carries a "keep the two in step" instruction against the
  interceptor, but has no production caller yet. So the rule is
  duplicated twice over today and three times once #17665 lands,
  which is the shape rule 5 exists to collapse. Billing policy, auth,
  workspace, monitoring, and incident fixes all cross that surface,
  which is wider than the line count suggests. This is the real cost
  of the decision, and rule 5 is how it is paid down.

- **A residual 401 is unhandled on the site's top-up.**
  `createTopUpCheckout` throws `TopUpCheckoutError` on any non-OK
  response, including 401. Rule 2 removes the common cause — the token
  is minted immediately before the POST — so this is not mid-session
  expiry. What remains is a credential rejected between mint and
  validation: revoked workspace access, clock skew, server-side
  invalidation. The shared transport retries once; the site surfaces
  the failure to the user. The gap is narrow and a test pins the
  current behaviour, so the retry arrives with rule 5 rather than as a
  fourth copy of the rule. That test records the gap; it does not by
  itself guarantee the retry arrives correctly, which is what the
  replay-safety consequence below is about.

- **Replay safety is unchanged, but the retry is not free at
  convergence.** The site passes a per-attempt `idempotencyKey`, which
  is what makes a retry safe to add at all. It does not make the retry
  automatic. `transport.ts` gates the re-mint on
  `request.method === 'GET' || request.idempotencyKey !== undefined`
  and otherwise returns `authenticationRetrySkipped`, and it emits the
  key as an `Idempotency-Key` header — while
  `/api/billing/topup/checkout` reads `idempotency_key` from the body.
  So the rule 5 adapter has to satisfy both: lift the attempt key onto
  `BillingRequest.idempotencyKey` to unlock the retry, and keep it in
  the body for the endpoint. Doing only the first breaks the request;
  doing only the second silently ships convergence without the 401
  retry, which is the whole point of converging.

  Those two errors are not symmetric, and the single-call assertion in
  `buy-credits.test.ts` only catches the loud one. A header-only
  adapter fails on its first run. A body-only adapter leaves
  `idempotencyKey` undefined, takes the non-replayable branch, calls
  `fetch` once, and satisfies that assertion. So the same test also
  asserts the 401 rejection carries no `authenticationRetrySkipped`:
  vacuous against today's plain `fetch`, which cannot produce the
  field, and a real check once the transport can. It arms only if the
  adapter carries that flag across when it maps `BillingHttpResponse`
  onto `TopUpCheckoutError`, so the adapter must, rather than dropping
  it with the rest of the response.

- **This boundary has no codified owner, which is its own gap.**
  `CODEOWNERS` carries no entry for `packages/account/`,
  `apps/website/`, or either billing surface, so "domain-owner review"
  has nothing to resolve against. Billing — the transport, the
  commands, and the hosted app — was authored under FE-2212 through
  FE-2216; the session and identity half of the account layer has its
  own history. Rule 4 needs a named owner per side to attach to,
  recorded in `CODEOWNERS` rather than asserted per thread.
