/**
 * PoC/RFC: a discriminated union covering every real (distribution x
 * subscription tier) combination this frontend's billing/subscription UI
 * cares about. See the Slack thread linked from the PR this file shipped in.
 *
 * Distribution (`Local` vs `Cloud`) and subscription tier
 * (`Unsubscribed`/`Free`/`Standard`/`Creator`/`Pro`/`Founders`) are
 * independent axes, so every `{Distribution}And{Tier}` combination gets its
 * own case, including ones no call site currently branches on today (e.g. a
 * local/desktop build with a linked Cloud subscription above Free). Those are
 * legitimate states, not dead ends to collapse away: `userCapabilities.ts`
 * enumerates each of them by hand for exactly this reason.
 *
 * `desktop` and `localhost` collapse into a single `Local` distribution:
 * nothing in the current billing signals (`isCloud`) ever distinguishes
 * between them, so splitting them here would add cases no call site can
 * actually observe. `TEAM` is a workspace-level pricing-preview concept, not
 * a value the live subscription-tier signal ever reports, so it is
 * intentionally left out of the tier axis too.
 */
export type UserState =
  | { kind: 'LocalAndUnsubscribed' }
  | { kind: 'LocalAndFree' }
  | { kind: 'LocalAndStandard' }
  | { kind: 'LocalAndCreator' }
  | { kind: 'LocalAndPro' }
  | { kind: 'LocalAndFounders' }
  | { kind: 'CloudAndUnsubscribed' }
  | { kind: 'CloudAndFree' }
  | { kind: 'CloudAndStandard' }
  | { kind: 'CloudAndCreator' }
  | { kind: 'CloudAndPro' }
  | { kind: 'CloudAndFounders' }
