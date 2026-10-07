# ADR-UX-INTERRUPTIONS-0039: One Gate for Unprompted Surfaces

Date: 2026-10-07

## Status

Proposed

## Context

Several surfaces appear without the user asking for them: the release toast,
the What's New popup, the desktop-to-cloud dialog, the partner-node card, the
version-mismatch toast, the Vue-node switch popup, the first-run nudge and the
feature surveys. Each decided on its own whether the screen was free, and the
copies disagreed.

- `releaseStore.shouldShowPopup` deferred to the first-run tour and onboarding
  overlays; `shouldShowToast` deferred to nothing.
- `ReleaseNotificationToast.vue` and `VueNodeSwitchPopup.vue` each checked node
  selection mode; no other surface did.
- `FirstRunTourNudge.vue` checked only the dialog stack.
- `DesktopCloudNotificationController.vue`, the version-mismatch warning and
  the floating survey checked nothing, and each wrote its "already shown"
  state before anything was visible: a setting, a seven-day dismissal in
  local storage, and `markSurveyShown`. Holding any of them back after the
  fact would have lost them.
- `extensions/core/agentPanel.ts` and `AgentPanelRoot.vue` carry their own
  busy checks, with reason names that feed `AgentConsentNotOfferedReason`
  telemetry.

Vendors of in-app messaging cap their own messages and cannot see the rest of
the product, so a central decision has to live in the host application. The
Customer.io in-app plugin pinned in this repo exposes no pre-display hook.

## Decision

Add `src/platform/interruptions/`: one policy and one exposure log that every
unprompted surface asks before it appears.

- `interruptionPolicy.ts` is pure. Five tiers rank from `blocking` down to
  `research`. A surface defers to any active interrupter in a higher tier, or
  in its own tier with a lower `order`. The order tie-break exists so two
  same-tier surfaces cannot each defer to the other and flicker. `decide`
  returns `show` or `defer` with the blocker named.
- `interruptionStore.ts` is a leaf Pinia store: a registry of sources, a
  bounded in-memory exposure log, and a `trackInterruptionExposure` call for
  each change of outcome. It imports no other store, so a surface can use the
  gate without pulling in every blocker's module graph.
- `registerBuiltInSources.ts` registers the blockers that already exist as
  stores: any open dialog, the first-run tour, onboarding overlays and node
  selection mode. The app root (`GraphView.vue`) calls it once. The Getting
  Started screen registers itself from `firstRunEntry.ts`.
- `useGatedSurface(surface, eligible)` wraps a surface's own eligibility rules.
  While the surface is showing it registers as an interrupter, so surfaces
  ranked below it defer in turn. `useGatedAction` is the same for surfaces
  started once rather than rendered from state: the action runs the first time
  the surface is eligible and the screen allows it, so state it burns on show
  is never spent while the surface is held back.
- Deferral is not a drop. A deferred surface re-evaluates when the blocker
  leaves.
- A surface's own eligibility rules (settings, versions, cooldowns, seen flags)
  stay with the surface. The gate answers only whether the screen allows it
  now.

The gate evaluates only sources that can outrank the surface asking, which
keeps the reactive dependency graph acyclic: a surface never reads the getter
of one that reads it.

Alternatives considered:

- Each store registers itself with the gate. This scales better, but a source
  read inside its own store bypasses the store-level spies the existing
  release-store tests rely on, and it pushes the gate's import into every
  blocker. Central registration for stores that already exist, and
  self-registration where a blocker is a composable (the Getting Started
  screen), keeps both costs small.
- Keep per-surface checks and document them. Rejected: the checks had already
  drifted, and three surfaces burned their shown state before display.
- Gate toasts at `toastStore`. Rejected for now: about 340 call sites are
  results of user actions and must not be deferred.

## Consequences

### Positive

- One rule for what outranks what, with the blocker named in every deferral.
- Three surfaces no longer lose their one-shot state to a deferral.
- Every deferral and exposure is observable through one event,
  `app:interruption_exposure`, so collisions can be measured rather than
  guessed.
- A new unprompted surface adds one entry to `SURFACES` and one call to
  `useGatedSurface` or `useGatedAction`.

### Negative

- A dialog left open for a long time holds announcements back for as long as
  it stays open.
- A surface that opens a dialog of its own, such as the partner-node card's
  sign-in, is held back while that dialog is open and returns after it closes.
- `shown` in the log means eligible and not blocked. State local to a
  component, such as a dismissal that has not yet reached a setting, is not
  visible to the gate.
- The tour check is deliberately narrow: only the first-run tour holds
  announcements. Other tours, such as `appMode`, do not, because an existing
  test pins that behavior.

## Notes

Not covered by this decision, and still outside the gate: the Customer.io
in-app modal, extensions, the legacy `ComfyDialog`, toasts raised directly
through PrimeVue's `useToast`, the agent consent and onboarding busy checks,
the error overlay, and the full-screen reconnecting overlay. Frequency caps,
cooldowns between announcements and dropping stale deferrals are not defined
here because they need product numbers.
