# ADR-RELEASES-QA-0035: Generate Reviewable Release QA Drafts

Date: 2026-09-22

## Status

Proposed

## Context

Release QA planning repeats diff collection and test-case writing after each
cut. Flags and account requirements still need review, and branch creation
does not mean the candidate is deployed on testcloud.

## Decision

Generate a draft from resolved base and candidate SHAs using pinned test-plan
skills. Trigger on cloud branch creation, with manual dispatch for patches.
Keep deterministic context collection, validation and notification outside the
generation step. Publish an artifact and request scope/flag review before QA.

Use the candidate package version rather than incrementing main's version.
Require deployment and smoke confirmation at handoff. Direct Notion publishing
and automatic QA assignment are deferred because a generated draft cannot
establish flag access, environment readiness or the results deadline.

## Consequences

### Positive

The workflow can ship independently of cut scheduling and smoke automation.
Each draft records an inspectable snapshot and its unresolved setup questions.

### Negative

Generation consumes the configured model service and needs human review for
coverage. Artifacts expire after 30 days, so approved plans must be moved to
the team's durable QA document during handoff. Manual reruns can notify again.
