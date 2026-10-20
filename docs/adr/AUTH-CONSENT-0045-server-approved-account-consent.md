# ADR-AUTH-CONSENT-0045: Server-approved account consent

Date: 2026-10-19

## Status

Proposed

## Context

Desktop needs one approval for its account grant, then silent token exchanges
for workspaces where the user remains a member. Other OAuth clients still
approve access to one workspace.

## Decision

Render account consent only when the server challenge includes
`grant_mode: account`. Explain that it covers current and future memberships,
then submit approval without a workspace ID. Retain the existing permissions,
CSRF value, redirect validation and cancel action.

An absent mode keeps the existing workspace form. The client name and
`first_party` label do not establish account authority. Unknown modes fail
validation. Account challenges require an absolute, non-executable registered
redirect URI before consent is shown. Deploy this view before enabling backend
account-grant issuance.

The server rejects account approvals that include a workspace ID. This prevents
a cached legacy form from presenting workspace approval for an account grant.

## Alternatives and consequences

Inferring trust from the client name can misrepresent what the user approves.
Copying Platform's account session into this page adds a second auth flow.
Both alternatives are rejected. This view only renders the backend contract.

The backend rechecks membership and SSO policy for each workspace token.
The frontend does not implement those decisions.
