# ADR-RELEASES-core-backports-follow-the-consumer-pin: Core backports follow the consumer pin

Date: 2026-11-19

## Status

Accepted

## Context

[ADR-RELEASES-one-label-requests-core-backports](RELEASES-one-label-requests-core-backports.md) replaces
the target label decisions below. The policy for branch eligibility and freezes
still applies.

Cloud uses continuous delivery. Core release branches remain useful while ComfyUI consumes them or a newer release is being prepared. A fixed label count can retire a consumed line or keep obsolete targets available.

## Decision

Use the frontend pin on ComfyUI's default release mainline as the core support boundary. Preserve a previous release line for a 72-hour rollback window, and keep upcoming release lines viable. Patch updates do not restart this window.

Derive the boundary from first-parent history and committer timestamps, including the pin in effect at the start of the window. This excludes pins confined to development branches. It also recovers the policy after missed workflow runs without a separately maintained timer. This assumes mainline commit times represent adoption. Backdated direct pushes require operator intervention.

Freeze obsolete branches with a separate ruleset instead of deleting refs or changing shared release protections. A later rollback can restore writes and recreate the target label. Deleting a target label removes its historical associations, so restoring the label does not restore those associations.

Backport creation and auto-merge must resolve the same boundary independently of labels. Label deletion alone cannot prevent explicit requests for obsolete targets. An unreadable or incomplete pin history must stop automation rather than permit a backport or retire a branch.

## Alternatives

A fixed retention count does not represent consumer adoption. A persisted timer adds state that can become stale after a missed event or rollback. Deleting branches would make rollback recovery harder and discard the stable branch reference.
