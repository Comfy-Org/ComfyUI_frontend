# ADR-DEVEX-QUALITY-0040: Share a versioned code-quality package

Date: 2026-10-02

## Status

Proposed

## Context

Platform stays in its own repository. Copying Frontend lint, formatting and audit
policy leaves consumers maintaining engine compatibility and policy drift.
Separate configuration packages alone do not give Platform a single tested update.

## Decision

Publish `@comfyorg/code-quality` from Frontend. Pin compatible engines and common
plugins, export reusable policies, and provide thin lint/format/audit commands.
Keep native tool configuration and caching; add no task graph or build orchestration.

Frontend retains Oxfmt; Platform retains Prettier and Nuxt's generated ESLint
adapter. Repositories own paths, framework configuration, application restrictions,
ignore files, baselines, typechecks, builds and tests. ESLint-only use is supported;
overlapping rules may only be disabled where the same files run through Oxlint.

Validate the tarball in clean npm and pnpm consumers before release. Reuse the
existing version-bump PR and publication workflow. Changes that introduce failures
in passing consumers are breaking changes. Consumers pin one package version and
commit its lockfile; rollback reverts both.

## Consequences

### Positive

- Tool compatibility and common policy have one owner and a tested release unit.
- Platform can update shared guardrails without copying Frontend configuration.

### Negative

- The package installs both formatter and linter engines even when one is unused.
- Framework adapters and local scopes still need consumer tests.
- Publishing and adoption remain ordered steps; a passing local tarball does not
  establish a successful registry release.
