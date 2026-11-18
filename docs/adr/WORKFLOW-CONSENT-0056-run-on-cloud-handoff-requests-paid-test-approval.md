# ADR-WORKFLOW-CONSENT-0056: Run on Cloud handoffs request paid-test approval

Date: 2026-11-18

## Status

Proposed

## Context

The handoff's unconditional execution ban overrode the CLI skill and prevented
agents from offering a paid test. Removing it alone would let older skills treat
the initial handoff as spending consent.

## Decision

The shared handoff prompt requires an explicit yes to one paid workflow job,
including validation and preflight runs, with a cost explanation. Preparation
approvals remain separate. A declined or unanswered test request still returns
the saved ready-to-run workflow link with execution marked unverified. The CLI
skill implements the same policy; the handoff states it for older CLI versions.

## Alternatives and consequences

A blanket ban protects spending but disallows approved tests. Deferring entirely
to the skill requires a coordinated CLI release or version-floor bump. An
explicit handoff rule supports mixed versions at the cost of brief duplication.
This changes agent instructions, not runtime job authorization or visual UI.

## Validation

Handoff tests cover clipboard delivery on local and Desktop, app delivery to
Claude and Codex, and preservation of the saved workflow source.
