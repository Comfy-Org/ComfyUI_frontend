# ADR-MESSAGING-ARBITER-one-pure-decision-for-pushed-messages: One pure decision for pushed messages

Date: 2026-11-22

## Status

Accepted

## Context

Onboarding, What's New, release prompts, CMS news, PostHog surveys and
promo cards each decide on their own when to show. They overlap, repeat,
and report eligibility as if it were a render. The messaging playbook
(https://github.com/Comfy-Org/messaging-playbook) sets the product rules: one
pushed message per day, one slot at a time, quiet moments only, a priority
order, and per-message identity and done state. Issue #22003 owns the
runtime contract.

## Decision

`src/platform/messaging/messageArbiter.ts` is the one place that decides.
It is a pure function of one moment: candidates (envelopes with ID,
version, class, source, form, owner, dates, kill switch, audience,
`replaces`), the moment (session start, working, break, hidden), what is on
screen, the day's budget, and per-message exposure. It returns one result
per candidate (`show`, `defer`, `displace`, `suppress`) with a reason, and
at most one pushed message for the slot.

- Callers resolve audience and kill switch and pass `now`. The core reads
  no clock, storage, store or vendor SDK, so every policy case is a table
  test. The playbook examples are ported as cases; they are the source, the
  test table is the oracle.
- A text edit keeps the ID and bumps the version; done holds across
  versions. A correction that must reshow takes a new ID with `replaces`;
  the old message is withdrawn and its done state does not carry over.
- Critical messages and recommended updates skip the daily budget.
  Critical messages are exempt from the 3-showings rule and return next
  session after a close. An opted-in tester gets one extra push per day for
  feedback messages only.
- A pushed message with no owner or no end date never shows. A cached
  message never shows past its end date or while switched off.
- `displace` is a system close, never a dismissal, and never counts
  toward done.
- At sign-in, install and account exposure merge to the stricter value:
  done wins, showings never decrease, the later snooze holds.

## Alternatives considered

- Producers keep their own checks and read a shared "something is open"
  flag. That is today's model with one more boolean; it cannot express
  priority, the budget or replacement, and local collision fixes keep
  accumulating.
- A Pinia store as the core. State and timing would be mixed into the
  rules, and policy cases would need a mounted store and fake timers.
- Using the playbook site's `decide()` as the oracle. It illustrates rules
  for people with simplified inputs; fixtures belong next to the code that
  runs them.

## Consequences

Not yet decided here, and next on #22003: the cross-tab lease (one pushed
slot across tabs, budget spent only on a confirmed render), lifecycle
events with event and attempt IDs, and the producer adapters in the order
onboarding, What's New/release, CMS announcements, PostHog surveys, then
custom pushes. Until an adapter exists, no producer calls this module.
