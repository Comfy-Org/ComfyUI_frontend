# ADR-WORKSHOP-TELEMETRY-0034: Browser delivery health for Models

Date: 2026-09-18

## Status

Proposed

## Context

Models can return Router/provider HTTP 200 while the browser fails to parse or display the output. PostHog supports product analysis but is not the incident-response sink. Router logs alone cannot observe a browser upload failure or distinguish website traffic without client attribution.

## Decision

Extend the accepted TELEMETRY-ROUTING-0013 responsibility split to the standalone website: the existing Workshop capture boundary sends an allowlisted run record to Datadog Browser Logs independently of PostHog initialization. Use the existing public Datadog client token, 100% session sampling, and no automatic error, console or network collection. Remove SDK page/referrer/identity context, including both session ID fields. No credentials, prompts, media URLs, raw errors or user/workspace IDs enter this contract.

Use Browser Logs for this bounded operational stream instead of importing the Cloud application's RUM/TelemetryRegistry into the separate Astro app. Ingested-log metrics support counts before index exclusions and share the responder's Router log workflow. This is a website-specific transport extension, not a replacement for Cloud RUM or `reportError`.

A parsed response remains pending for health until the primary media element loads: image load, or decoded video/audio data. A delivery error/visible-page timeout is a service failure. Becoming hidden cancels the observation immediately, so a throttled timer cannot report an outage after the tab returns. Audio retains metadata preload and starts its deadline only on attempted playback; untouched audio stays unverified. Navigation, interrupted playback before readiness, protected output and non-media output stay excluded/unverified. Attachments and subsequent full playback are outside this initial readiness signal. PostHog's existing run-finished semantics remain unchanged; delivery is a separate event.

Identified account and authentication refusals are excluded from service health using existing Router refusal metadata. Browser credential refusals receive a bounded telemetry-only `credential` stage without changing authentication behavior or the Router error contract. Missing endpoints, storage upload failures and unclassified unavailability remain service failures.

Validation failures after submission or without an actionable field mapping count as service failures because the website owns the submitted parameters. Field-level input validation that prevents submission and unreadable selected local files are user-correctable preflight outcomes and stay excluded from service health. Preflight form validation events remain separate from completed runs. Sanitized exception names and application bundle locations are retained for diagnosing browser preparation failures; raw exception messages and stacks are excluded.

Each browser attempt has a UUID shared by its run and delivery events. The existing Router request ID, including the durable queue ID, joins browser outcomes to server logs when available. Keep the existing Router request contract so browser reporting can deploy independently; server-side Models attribution requires a separate documented and deployed Router change. Recovery preserves the browser attempt ID and idempotency behavior; a fresh Run click starts a new attempt. Private infrastructure owns metrics, dashboard, thresholds and notification routing. IDs stay in logs, not metric dimensions.

## Consequences

### Positive

The browser/server join explains HTTP-200-without-output failures. Production and preview health stay separate, and a per-model minimum-volume gate avoids provider averages hiding an active broken model.

### Negative

Browser blocking and page termination can drop observations. A first loaded frame does not establish full video playback or every attachment's availability. No-data is unobserved, not healthy; this is not a billing ledger. Log metrics start at deployment and cannot reconstruct historical PostHog incidents.

### Alternatives rejected

- Router-only monitoring cannot see client delivery.
- PostHog-only reporting lacks the required on-call path.
- Scheduled paid probes are outside the requested scope; quiet models need no alerts.
- Automatic collection/session replay would expand the data and privacy scope without proving the run outcome.
