# ADR-WEBSITE-RENDER-0031: Shared model rendering and live verification

Date: 2026-09-10

## Status

Proposed

## Context

Testing hand-built provider requests cannot prove that a model page works.
Per-provider page logic also makes generic templates and catalogue-wide tests
expensive to maintain. Existing native contracts and request templates already
encode the final wire format and must remain authoritative.

## Decision

Use one browser-safe `router_render` execution boundary for model pages and the
Node test runner. Standard parameters map through shared field metadata into the
existing form values, then use the established media uploader, native request
compiler, Router transport and response parser. Endpoint exceptions adapt the
contract before the catalogue creates the page. Starter media belongs to shared
page defaults and is never substituted only inside the test runner.

Keep account refresh, workspace changes and retry identity with the page; pass
those behaviors into the shared boundary. Keep environment-secret lookup in the
Node wrapper. Verify generated artifacts by downloading and decoding them in a
bounded-concurrency CLI, with one idempotency key and durable evidence per case.

Maintain a versioned Markdown results grid with companion JSON state. Merge by
page, environment and input mode so partial runs preserve previous evidence.
Keep local validation, live generation and account-level blocks distinct; retain
the last verified pass even after a later failed attempt. The public ledger is
an allowlisted summary of private run evidence and informs explicit catalogue
availability decisions without automatically disabling models.

Rejected alternatives: duplicated test requests, one implementation per provider,
and an expressive JSON template language that embeds control flow or network I/O.
The existing typed templates and named callbacks remain sufficient.

## Consequences

### Positive

- Default tests exercise the request and response path users actually run.
- New models usually need mapping/default data rather than new page components.
- URL and byte inputs share the same storage/encoding behavior.
- Failed validation, provider rejection and invalid output remain distinguishable.

### Negative

- Local validation cannot establish availability, billing, policy or provider success.
- The caller must supply a credential and own disposal of returned Blob URLs.
- Account concurrency limits bound a live sweep independently of its worker count.
- Models that require prior provider jobs still need an explicit prerequisite adapter.
