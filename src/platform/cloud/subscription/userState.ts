/**
 * PoC/RFC: a discriminated union covering every real (distribution x
 * subscription tier) combination this frontend's billing/subscription UI
 * cares about. See the Slack thread linked from the PR this file shipped in.
 *
 * `desktop` and `localhost` collapse into a single `Local` case: nothing in
 * the current billing signals (`isCloud`, subscription tier) ever
 * distinguishes between them, so splitting them here would add cases no call
 * site can actually observe. `TEAM` is a workspace-level pricing-preview
 * concept, not a value the live subscription-tier signal ever reports, so it
 * is intentionally left out of this union too.
 */
export type UserState =
  | { kind: 'Local' }
  | { kind: 'CloudUnsubscribed' }
  | { kind: 'CloudFree' }
  | { kind: 'CloudStandard' }
  | { kind: 'CloudCreator' }
  | { kind: 'CloudPro' }
  | { kind: 'CloudFounders' }
