# Website delivery validation

The website trial answers one practical question: can a non-technical owner ship a website-only
change on their timeline while the rest of the monorepo keeps its current safeguards?

## Current lane

The checked-in policy is `.github/fast-lanes/website.json`. It allows changes only under
`apps/website/`. Stage 1 includes `bertfy` as a trusted author and also accepts a fresh
`website-fast-lane:approve` label from one of the listed operators. `website-fast-lane:hold`, a
draft, a human change request, a fork, a mixed-path change, or a stale head stops the lane.

The `website-approval` environment supplies `WEBSITE_APPROVAL_TOKEN`. The credential currently
belongs to `christian-byrne`, whose team membership satisfies the website path review rule. The
workflow verifies that identity before it acts and cannot approve Christian's own pull requests.
After approval it uses squash auto-merge or enters an already-clean exact head in GitHub's native
queue without queue jumping. Later status and workflow-run events reconcile the decision.

For a website-only pull request, the required lint context runs website-scoped lint, format,
typecheck, and unused-code checks. A change outside `apps/website/` falls back to the full repository
jobs. CodeRabbit is excluded from `apps/website/**` for this trial; human change requests still
block the lane.

## Production identity and rollback

Each website preview and production build writes a cache-disabled `/__build.json` with the
repository, exact source SHA, workflow run, attempt, and build time. Deployment verifies the
immutable Vercel URL before accepting canonical `comfy.org` promotion and saves the previous and
new deployment IDs and SHAs as a short-lived transition artifact.

`validation-website-rollback.yaml` accepts an immutable deployment ID and expected SHA. Its default
mode validates the target and marker without changing production. With `perform_rollback` enabled,
it performs an instant rollback, verifies the canonical marker and public homepage, then promotes
the same known-good deployment so normal production assignment can resume.

The first production deployment containing `/__build.json` is bootstrap evidence, not the positive
canary. Before opening the disposable canary:

1. Download that deployment's transition artifact.
2. Run `Validation: Website Production Rollback` with its `deployedDeploymentId` and `deployedSha`.
3. Leave `perform_rollback` disabled and require the no-mutation preflight to pass.
4. Run the canary from update through production, then exercise rollback only under the agreed
   trial procedure.

## Evidence to record

Record timestamps for the contributor update, required checks, policy approval, queue entry, merge,
and verified production SHA. Also record any manual intervention, confusing UI, false-positive
check, or rollback problem. The trial succeeds only if the contributor can follow the path without
developer rescue and production can be tied to the expected commit. The allowlist should not expand
until the canary and rollback evidence are complete.
