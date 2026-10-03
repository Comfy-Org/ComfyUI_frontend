# ADR-RELEASES-CADENCE-0035: Maintain the Active QA Line Across Release Cuts

Date: 2026-09-22

## Status

Proposed

## Context

Twice-weekly cuts can create a new cloud branch before QA finishes the previous
one. Selecting only the newest branch for patch bumps also stops automatic
translation regeneration on the branch QA is still testing.

## Decision

Use GitHub's Pacific timezone schedule for the cuts. Keep branch creation behind
the existing reviewed version-bump PR. Identify a cut by its original workflow
run's Pacific date so reruns after merge do not cut a second release.

Maintain the union of the newest cloud branch and the effective testcloud branch
from the cloud repository. Keep the existing per-branch pending-PR and change
checks. Reject unreadable configuration instead of treating it as no active QA.

Testcloud rotation remains a sheriff-reviewed change. A separate candidate queue
or registry would duplicate the deployment configuration without improving this
limited maintenance task. A fixed UTC schedule would drift with daylight saving
time; deriving the timezone from the runner clock would mishandle delayed runs.

## Consequences

### Positive

An overlapping QA cycle retains patch and translation maintenance without
moving its environment or copying fixes between branches.

### Negative

Automatic branch selection requires read access to the private cloud config.
An unavailable config blocks the daily sweep; an explicit branch dispatch is
the recovery path. An open cut PR holds another scheduled cut until resolved.
