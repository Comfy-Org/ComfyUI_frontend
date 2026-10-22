# ADR-AUTH-SESSION-0045: Desktop reuses account sessions

Date: 2026-10-20

## Status

Proposed

## Context

Desktop needs SSO and workspace changes without separate workspace consent.
The shared session in ADR-AUTH-SESSION-0037 already supports both account
identity and backend workspace checks. That ADR initially excluded native
clients from its browser-cookie transport.

## Decision

Extend the existing login-code handoff with an explicit account-session mode.
The hosted page redeems these codes through its shared session, including for
SSO-only accounts. The existing confirmation remains bound to the exact code
and account. Legacy Firebase login codes retain their current behavior.

Desktop holds a separate native credential backed by the same session
repository. It never copies the browser cookie into local ComfyUI or presents
a fake browser Origin. The backend preserves the source login's identity,
SSO proof, and absolute deadline.

Desktop requests workspace access through the existing token endpoint.
Partner-node credentials come from Desktop's main process through an optional
bridge capability. Older Desktop versions retain the existing OAuth mint
path. A failed native mint does not fall back to using a workspace token as
an account credential.

## Consequences

The backend and hosted page must ship before the new Desktop login flow.
Non-SSO users need the shared-session rollout enabled; SSO users already use
that session. No new permission model or generic OAuth account grant is needed.

The account-core browser transport remains unchanged. Browser cookies stay
host-only, and local pages receive only credentials scoped to their task.
Native session storage, expiry, and revocation remain Desktop/backend concerns.
