# ADR-RELEASES-0062: One label requests core backports

Date: 2026-11-24

## Status

Proposed

## Context

[ADR-RELEASES-0059](RELEASES-0059-core-backports-follow-the-consumer-pin.md) uses the ComfyUI pin and rollback window to limit which core branches can receive a backport. Asking authors to pick version labels made sense when more branches were writable. Now it makes the common request harder and can leave an eligible branch without the fix.

## Decision

`needs-backport` requests a backport to every eligible core branch. The pin still decides eligibility, and each backport still needs review and passing checks. If a branch does not need the fix, close its generated PR or leave a conflicting cherry-pick unresolved. Normal retries respect a closed generated PR.

Keeping target labels would let authors opt in branch by branch. That precision is rarely needed, and closing an unwanted PR leaves the decision visible where reviewers would approve the backport. A requester who only wants one branch can cherry-pick there by hand.

This replaces the label lifecycle in ADR-RELEASES-0059. Branch cuts and rollbacks no longer create version labels. Existing labels have no effect on targeting and stay in place to preserve PR history.
