# Release Process

## Bump Types

All releases use `release-version-bump.yaml`. Effects differ by bump type:

| Bump       | Target     | Creates branches?                     | GitHub release               |
| ---------- | ---------- | ------------------------------------- | ---------------------------- |
| Minor      | `main`     | `core/` + `cloud/` for previous minor | Published, "latest"          |
| Patch      | `main`     | No                                    | Published, "latest"          |
| Patch      | `core/X.Y` | No                                    | **Draft** (uncheck "latest") |
| Prerelease | any        | No                                    | Draft + prerelease           |

## Generated API types on release branches

Never hand-edit files under `packages/ingest-types/src`, including in a
backport. The Cloud repository owns the source OpenAPI contract and generates
the frontend package for `main` and every active `cloud/x.y` line named in its
`frontend-version.json`. A release branch must accept that generated contract
or a newer one; unrelated generated changes are expected when a release line
has fallen behind.

If a backport needs a generated type, update the Cloud OpenAPI source and use
the typegen automation. Do not copy or recreate one declaration in a generated
file.

**Minor bump** (e.g. 1.41→1.42): freezes the previous minor into `core/1.41`
and `cloud/1.41`, branched from the commit _before_ the bump. Nightly patch
bumps on `main` are convenience snapshots — no branches created.

The minor bump is scheduled automatically: `release-version-bump.yaml` runs a
**minor** bump on `main` every Monday 20:00 UTC and enables auto-merge on the
resulting `version-bump-*` PR (marked with the `weekly-release-cut` label, which
exempts it from the nightly stale-PR closer), so once its checks pass the merge
triggers `release-branch-create.yaml` and the `core/` + `cloud/` cut is
hands-off. The separate nightly `0 0 * * *` cron stays a **patch** bump.

**Patch on `core/X.Y`**: publishes a hotfix draft release. Must not be marked
"latest" so `main` stays current.

### Dual-homed commits

When a minor bump happens, unreleased commits appear in both places:

```
v1.40.1 ── A ── B ── C ── [bump to 1.41.0]
                │
                └── core/1.40
```

A, B, C become v1.41.0 on `main` AND sit on `core/1.40` (where they could
later ship as v1.40.2). Same commits, no divergence — the branch just prevents
1.41+ features from mixing in so ComfyUI can stay on 1.40.x.

## Backporting

1. Add `needs-backport` + version label to the merged PR
2. `pr-backport.yaml` cherry-picks and creates a backport PR
3. Conflicts produce a comment with details and an agent prompt

## Release Sheriff Assignment

`pr-assign-release-sheriff.yaml` assigns the on-call release sheriff to any
open PR that has no assignee and is either:

- a backport (label `backport`, or a `[backport ...]` title);
- a release version bump (label `Release`, or a `version-bump-<version>`
  branch);
- opened by automation — `dependabot`, `comfy-pr-bot`, or `cloud-code-bot`.

It also requests their review, since backport merges are gated on an approval.
Existing assignees and review requests are never overwritten.

When the sheriff wrote the PR themselves, the review is requested from the
**next person in the rotation** instead — GitHub rejects a self-review request,
so previously those PRs were assigned to their own author with nobody asked to
review, and then waited on an approval that had never been requested. The order
comes from the Datadog layer's member list, so it needs no separate config. If
nobody in the rotation can stand in, the run says so rather than staying quiet.

Automation-authored PRs are included because nobody feels addressed by what a
robot opens: they accumulated unassigned for weeks. Note these are matched by
author rather than by content, so a dependency bump counts as sheriff work.

It runs on PR events and hourly. Bot PRs are picked up by the hourly sweep
rather than on open — the `pull_request_target` gate matches labels, titles and
branches, and teaching it about bot logins would duplicate the author list in a
second syntax (the webhook says `dependabot[bot]` where `gh` says
`app/dependabot`), which would drift.

The rotation itself lives in Datadog On-Call ("Frontend Team – Oncall
Schedule", layer "Release Sheriff") and is read at execution time, so handovers
need no commit.

Datadog exposes no GitHub identity, and GitHub only resolves commit emails its
users chose to publish, so the two have to be bridged explicitly. That bridge
lives on the Datadog schedule as tags, one per sheriff:

```text
github:<datadog-email-local-part>:<github-login>
```

So `ben@comfy.org` → GitHub `benceruleanlu` is the tag `github:ben:benceruleanlu`.
**Adding someone to the rotation therefore means adding their tag in the Datadog
UI — no commit.** Tags are only settable at schedule-creation time over the API,
so edit them in the on-call UI. Datadog rejects `@` and `+` in tags and
lower-cases what it accepts; GitHub logins are case-insensitive, so a
lower-cased login still resolves.

Only `scheduleId`, `datadogSite` and `fallbackGithubLogin` stay in the `CONFIG`
object of `scripts/release-sheriff/release-sheriff.ts`. Note `datadogSite` is
`us5.datadoghq.com` — the Comfy org lives on that sub-domain and the default
`api.datadoghq.com` returns 403.

Requires repo secrets `DATADOG_API_KEY` and `DATADOG_APP_KEY` (scope:
`on_call_read`).

If the on-call user cannot be mapped — a missing tag, missing secrets, an
unreachable Datadog — the job still assigns `fallbackGithubLogin` so PRs are
never left unowned, but **exits non-zero** so the degradation is visible. A
green run means a real sheriff was resolved from Datadog.

Tag coverage is checked for the **whole rotation**, not just whoever is on call,
and a member without one fails the run. Someone added to the layer without a tag
otherwise works fine until their own shift begins — the breakage surfaces weeks
after the cause, on whoever happens to be sheriff. This is a configuration
check, so it fails even when today's assignment succeeded.

A failed run also posts to **#frontend-releases** with the reason, because a
failing scheduled workflow otherwise only notifies whoever last pushed to
`main` — in practice nobody, which is how the placeholder config survived for
weeks. Needs the `SLACK_BOT_TOKEN` secret; the post is `continue-on-error`, so
Slack being down never masks the underlying result.

It alerts on the **transition** into failure, not on every failing run: the job
runs hourly, so a lasting breakage would otherwise post around the clock until
someone fixed it, and a channel that cries wolf gets muted.

The check walks recent **scheduled** runs and reads the conclusion of the
`Assign release sheriff` **step**, not of the run. A run that died in checkout
failed without ever reaching the sheriff, and treating that as "already
alerted" would swallow the next real failure. Scheduled runs are used because
the `pull_request_target` gate skips most other runs, so they are the ones
dense in runs that decided anything. If the check itself cannot run it fails
open and alerts, since a duplicate beats a silence.

Only scheduled runs **alert**, for the same reason: a run can recognise a
duplicate only within the history it reads, so the runs that post have to be
the runs that get read back. While the two sets differed, every PR-triggered
failure was invisible to every other one — five posts in nine minutes when a
rotation member turned up without a `github:` tag. PR-triggered runs still go
red on the PR itself; the alert rides the hourly sweep instead, so a new
breakage is announced within the hour rather than on the spot.

## Publishing

Merged PRs with the `Release` label trigger `release-draft-create.yaml`,
publishing to GitHub Releases (`dist.zip`), PyPI (`comfyui-frontend-package`),
and npm (`@comfyorg/comfyui-frontend-types`).

## Weekly ComfyUI Integration

`release-weekly-comfyui.yaml` runs every Monday — if the next `core/`
branch has unreleased commits, it triggers a patch bump and drafts a PR to
`Comfy-Org/ComfyUI` updating `requirements.txt`.

## Workflows

| Workflow                         | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `release-version-bump.yaml`      | Bump version, create Release PR                    |
| `release-draft-create.yaml`      | Build + publish to GitHub/PyPI/npm                 |
| `release-branch-create.yaml`     | Create `core/` + `cloud/` branches (minor/major)   |
| `release-weekly-comfyui.yaml`    | Weekly auto-patch + ComfyUI requirements PR        |
| `pr-backport.yaml`               | Cherry-pick fixes to stable branches               |
| `cloud-backport-tag.yaml`        | Tag cloud branch merges                            |
| `pr-assign-release-sheriff.yaml` | Assign on-call sheriff to backport/release/bot PRs |
