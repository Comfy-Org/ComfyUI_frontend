# Website delivery validation

The website trial answers one practical question: can a non-technical owner ship a website-only
change on their timeline while the rest of the monorepo keeps its current safeguards?

## Current lane

The `website` entry in `tools/cicd/fast-lane/src/lanes.ts` is the policy. It allows changes only
under `apps/website/`. `bertfy` is a trusted author. For other authors, a listed operator adds
`website-fast-lane:approve` to the current head; removing it withdraws the approval.
`website-fast-lane:hold`, a draft, a human change request, a fork, or a mixed-path change stops the
lane. A hold does not undo a merge that already happened. To resume after a hold, remove
`website-fast-lane:hold`; for an author who is not in the allowlist, also remove and re-apply
`website-fast-lane:approve`. If the run for an approval label shows as cancelled, a listed operator
re-runs it or re-applies the label; a re-run works only while the head is unchanged.

The `website-approval` environment supplies `WEBSITE_APPROVAL_TOKEN`. The credential currently
belongs to `christian-byrne`, whose team membership satisfies the website path review rule. The
workflow verifies that identity before it acts and cannot approve Christian's own pull requests.
After approval it uses squash auto-merge or enters an already-clean exact head in GitHub's native
queue without queue jumping. Each `CI: Tests E2E` or `CI: Website E2E` completion re-runs the lane
for its pull request in case native auto-merge did not hand the head to the queue.

Website-only pull requests run the normal required checks; the core unit and browser suites already
skip when nothing outside `apps/` changed. CodeRabbit is excluded from `apps/website/**` for this
trial; human change requests still block the lane.

## Production identity and rollback

Each production deploy records a `website-production` GitHub deployment for its commit, with the
immutable Vercel URL. To roll back, use Vercel's Instant Rollback on the last good production
deployment (dashboard or `vercel rollback <url>`). Vercel then stops assigning new production
deployments, so once the fix has merged, use Undo Rollback (or `vercel promote <url>`) on it.

## Evidence to record

Record timestamps for the contributor update, required checks, policy approval, queue entry, merge,
and production deployment. Also record any manual intervention, confusing UI, false-positive
check, or rollback problem. The trial succeeds only if the contributor can follow the path without
developer rescue and production can be tied to the expected commit. The allowlist should not expand
until the canary and rollback evidence are complete.
