# ADR-BILLING-0064: Manual Top-up Maximum Is Served per Workspace

Date: 2026-11-28

## Status

Accepted

## Context

D6 v2 allows staff to raise or lower a workspace's manual top-up maximum.
A purchase maximum embedded in generated request validation would require
shipping every client again whenever that workspace's limit changes.

## Decision

Use the balance response's `max_topup_cents` for client amount validation.
Hosted checkout reuses its existing balance read and defers to the server
when that response has no maximum. The server remains the purchase authority,
including when a limit changes after a quote or balance read.

Generate ingest types from the projected frontend specification, retaining
minimum and return-URL validation. Whole-dollar enforcement stays on the
server because generated int64 validation does not implement `multipleOf`.

Identify above-limit refusals by `INVALID_AMOUNT` and
`details.reason = "above_max"`, carrying that meaning through host adapters.
Refusal copy omits a numeric limit because an earlier balance or quote may
already be stale. Picker hints may display the served maximum.

## Alternatives

A schema constant cannot express a workspace-specific limit. Removing client
maximum validation altogether would send amounts the current balance already
identifies as invalid and leave lowered-limit dialogs on invalid defaults.

## Consequences

Generated contracts and handwritten behavior must reach both `main` and the
active Cloud production release line. Auto top-up limits and settlement of
previously accepted purchases retain their existing server behavior.
