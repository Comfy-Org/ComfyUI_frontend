# 19. Unified Recoverable Diagnostics

Date: 2026-08-25

## Status

Proposed

## Context

The frontend reports failures through a mix of thrown errors, `console` calls,
`reportError()`, telemetry events, and host-specific integrations. A thrown
error is visible when something catches it, but it can also interrupt work or
leave a mutation half-applied. A `console.error` can keep the application
running, but it provides little production visibility on its own.

We need one way to record errors, warnings, and diagnostic logs while allowing
each platform to choose the appropriate local and remote destinations. The
system should preserve evidence that a failure happened without turning every
recoverable problem into an application failure.

## Decision

Introduce one application-facing diagnostics system with platform-owned
reporting adapters.

- Callers submit a structured diagnostic with a stable code, severity, cause,
  relevant context, and recovery outcome. They do not select Sentry, Datadog,
  the browser console, a desktop host, or another vendor directly.
- The diagnostics system selects destinations based on platform, severity,
  privacy, sampling, and service availability. Local console output remains
  available for development and fallback visibility.
- Reporting must never throw or block recovery. Failure in one destination
  must not prevent delivery to another destination or affect application
  behavior.
- Recoverable operations validate all known preconditions before mutation,
  report the diagnostic, and return an explicit failure result, safe sentinel,
  or no-op. Reporting is not a substitute for a caller-visible failure
  contract.
- Code may still throw when continuing would violate a security boundary,
  corrupt data, or produce an invalid object. Such failures are caught and
  reported at the nearest boundary that can provide a safe fallback or fail
  closed.
- Diagnostics must not include secrets or sensitive user data. Stable codes
  and bounded structured context are preferred over message parsing.

The concrete API, routing rules, adapters, and sampling policy are deferred to
the implementation. Existing `reportError()` and telemetry infrastructure
should be reused or evolved rather than bypassed with a second reporting path.

## Migration path

Adopt the system incrementally. Start with recoverable paths that currently
throw, then migrate direct `console` and vendor calls as their contracts are
touched. Each migration must preserve caller behavior and add coverage that
the failed operation leaves state consistent.

## Consequences

- Recoverable failures remain observable across browser, cloud, desktop, and
  future platforms without coupling application code to reporting vendors.
- Stable diagnostic codes support alerting and cross-platform investigation.
- Explicit failure contracts and precondition checks reduce partial updates
  and accidental success after an error.
- The migration adds structured metadata and routing work. Poorly chosen
  no-ops or sentinels can hide failures, so callers and state consistency must
  be reviewed before replacing a throw.

## References

- [ADR-0013: Telemetry Service Selection](0013-telemetry-service-selection.md)
- [FE-1859](https://linear.app/comfyorg/issue/FE-1859/audit-and-replace-unsafe-throw-new-error-paths-with-fail-safe-handling)
