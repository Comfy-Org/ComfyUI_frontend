# ADR-BILLING-0049: Separate Billing from Workspace Membership

Date: 2026-10-27

## Status

Accepted

## Context

Workspace membership and billing used the same API module and store. Billing
published plan and rail state into workspace records, while workspace screens
called billing composables. Moving the billing client alone would leave those
dependencies in place.

Legacy account operations remain supported. A legacy account can use the unified
catalog and workspace checkout while retaining legacy balance and top-up
operations. The SDK rollout flags select a transport independently of that
account routing.

## Decision

Workspace owns identity, selection, membership and invitations. Billing reads
those concerns through readonly identity/session ports and a separate membership
command port for downgrade. Identity reset and workspace transition generations
remain distinct: switching preserves per-workspace presentation, while an actor
change clears it. Requests still invalidate at switch start, including a return
to the original workspace.

Billing owns account routing, plan presentation, capabilities, catalogs, checkout
and payment operations. List-provided subscription tiers seed presentation;
non-null active subscription responses may replace that summary. Presentation
never grants permission. Controls continue to render served capability facts.

The existing legacy reactivation and pricing-entry fallbacks remain interim
policy under BE-23885 and `pendingServerFact`. Their replacement needs backend
confirmation of the served facts across supported rails. This extraction does
not change those permissions.

Account UI composes billing with membership. Mixed menus, member settings and
auth bootstrap belong to that owner. Workspace mutation views emit successful
changes; their account or billing owner refreshes billing, including partial
invite success. Billing requests the team-workspace dialog through a host
callback installed at bootstrap rather than importing account UI.

The declaration-backed `@comfyorg/billing-core` package owns the billing client
contract and SDK composition. It accepts transport, authentication, URL,
telemetry and lifecycle dependencies. Shared ingest plumbing supplies one Axios
instance to both clients, preserving request auth, remint retries, error identity
and capability-revision invalidation. Existing framework-free account-core
billing primitives remain dependencies. Host-specific Vue state stays in the app.

Dependency rules reject workspace imports of billing/account, billing imports
of workspace stores/API/composables or account UI, and shared ingest imports of
either domain.

## Retained Presentation Differences

- Legacy top-up launches hosted checkout and returns before settlement.
  Workspace top-up confirms and charges a saved card, with pending, 3DS and
  checkout-recovery states. They share controlled amount fields; neither flow
  treats a hosted launch as a completed payment.
- Grandfathered per-member Team pricing and unified per-credit Team pricing
  remain separate products. Their dialogs preserve their respective payloads,
  preview readiness and selection lifetime. Unified personal and Team checkout
  share preview rendering while retaining their distinct commands.
- The legacy pricing journey still includes solo-use messaging and workspace
  creation. It remains available while its fallback route is supported.
- New-payment and plan-transition previews show different actions and financial
  information. Shared success presentation remains separate from those steps.

## Alternatives

A billing facade injected into every workspace screen would remove direct
imports but retain mixed ownership. Moving the mixed containers to account UI
avoids that reverse dependency.

Replacing every legacy component with the workspace variant would change
payment completion semantics and the product being purchased. Consolidation is
limited to equivalent presentation.

This change does not migrate all existing account-core billing primitives to a
new publishing unit. The new package establishes client/composition ownership;
independent publication of those primitives is a separate migration.

## Consequences

Workspace can evolve membership without importing billing policy. Billing
consumers have an explicit package contract and narrow workspace dependencies.
Account UI carries the integration responsibility, and host applications must
install the team-workspace dialog callback before billing actions run.

Preserving live products leaves multiple pricing and payment presentations.
Removing one requires an explicit product or backend retirement decision.
