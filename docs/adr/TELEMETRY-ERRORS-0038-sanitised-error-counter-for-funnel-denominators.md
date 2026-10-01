# ADR-TELEMETRY-ERRORS-0038: A Sanitised Error Counter for Funnel Denominators

Date: 2026-09-26

## Status

Proposed

## Context

[ADR-TELEMETRY-ROUTING-0013](TELEMETRY-ROUTING-0013-telemetry-routing-across-consumers.md)
routes errors to Datadog and keeps PostHog as the product-analytics layer.
`reportError()` implements the first half: it fans out to Sentry, Datadog RUM
and the Desktop bridge, and has no product-analytics sink at all.

That leaves a gap ADR-0013 did not consider, because it reasoned about who
_consumes_ a signal rather than what a _missing_ signal is read as. A funnel
step whose instrument can also end in a thrown exception has two ways to emit
nothing, and product analytics cannot tell them apart:

- `requestConsentForCurrentUser`'s catch fired **23 times for at least 9
  people** on `cloud.comfy.org` between 2026-09-23 and 2026-09-26 (Sentry,
  `error_type:agent_consent_setting_load_failure`). Every one of those is a
  consent offer that ended without an outcome, and in PostHog it is
  indistinguishable from a user who was never eligible.
- Six separate investigations into "users who were offered consent and emitted
  nothing" have attributed that silence to behaviour. Some fraction of it is
  this channel.

Two further facts bound the design.

**PostHog's PII filter is key-based, not content-based.** `createPostHogBeforeSend()`
(`packages/shared-frontend-utils/src/piiUtil.ts`) deletes the keys `email`,
`prompt`, `user_email` and `$email`. An exception message under any other key
passes straight through. Exception messages on this surface demonstrably carry
URLs and account state. So "send the error and let the filter handle it" is not
available.

**The Datadog half of ADR-0013 is not carrying this surface.** Over the 30 days
to 2026-09-26, Datadog RUM holds **zero** events for all four `agent_consent_*`
`error_type` values, while Sentry holds 25 — and a comparable-volume sibling
(`agent_flag_gate_load_failure`, 27 events in three days) _is_ present in RUM,
so event volume alone does not explain it. ADR-0013 already warns that RUM is
"the systematically lossier of the two sinks", but a complete 30-day zero on
one surface is not obviously loss. The mechanism is unestablished and is filed
as a follow-up. Today, in practice, these failures reach Sentry only, and
Sentry joins to no funnel.

## Decision

`reportError()` emits `app:client_error_reported` to the telemetry registry for
an **allowlisted** set of `errorType` slugs. It is a counter, not a report.

1. **A closed payload, not a filtered one.** The event carries the caller's
   `errorType` slug, a `failure_kind` from a closed set, the report level, and
   an integer HTTP status when the error carried one. Message, stack, cause,
   `tags` and the free-form `context` bag never leave for product analytics.
   Safety is a property of the payload's shape, not of a downstream filter.
2. **Classification reads structured fields only.** `classifyFailureKind()`
   consults a kind the thrower declared, the constructor name against a closed
   table, the fixed strings each engine's `fetch` throws for a request that
   produced no response, then a numeric status — and returns a member of the
   closed set or `unclassified`. A browser changing its wording costs an
   `unclassified`, never a leak.
3. **An allowlist, `COUNTED_ERROR_TYPES`, is the whole surface.** It starts as
   the four agent-consent slugs.
4. **This is not an alerting path, and ADR-0013 still holds for one.** The
   counter exists so a funnel denominator can subtract failures it would
   otherwise count as behaviour. Anything that should page someone still goes
   to Datadog.
5. **`error_type` is deliberately identical to Sentry's tag**, so the two
   instruments compare with no translation and a disagreement between them
   reads as an instrument defect rather than a population change.

## Consequences

### Positive

- A funnel step's failures are subtractable from its denominator for the first
  time, in the tool that owns denominators.
- The privacy surface is one greppable set in one file rather than a judgment
  call at 100+ call sites.
- `http_status` makes a distinction visible that is in neither console today:
  Sentry receives no `extra`, so the status an error carried has never left the
  client. Seven of the 23 are an unparseable body whose status decides whether
  they are a normal 404 or a broken response.

### Negative

- Adding a slug to the allowlist is a decision with a volume cost, and the cost
  is large if taken carelessly: over the same three days `reportError()`
  produced ~690,000 events across 44 slugs, of which `graph_serialization_state_mismatch`
  alone was 378,042 from 13 people. A default-on sink was rejected for exactly
  this reason.
- The count is a floor. A report raised while another is still being delivered
  reaches the console only, and a page load emits at most
  `MAX_COUNTED_PER_ERROR_TYPE` of one slug.
- One slug can be raised from several call sites; the counter is their union
  and does not identify a code path. Events that describe how an _offer_ ended
  do that, and the two must not be summed.

### Alternatives rejected

- **A PostHog sink for every `reportError()` call.** Rejected on the volume and
  concentration measured above: a counter one looping client can move by five
  orders of magnitude is not a funnel instrument.
- **An `analytics: true` option at the call site.** Rejected because it spreads
  the privacy decision across every caller. PR #15444 already established that
  a convention at the call site regressed within a day of being written down,
  which is why direct-sink imports are lint-enforced instead.
- **Emitting the error and relying on PostHog's `before_send`.** Rejected: that
  filter is a four-key deny list, not a sanitiser.
- **Instrumenting each consent code path separately instead.** Complementary,
  not a substitute — and it leaves the error channel itself unreadable for
  every other surface. Those events describe how an offer ended; this one
  records that the channel fired.
