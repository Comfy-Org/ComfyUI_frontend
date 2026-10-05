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
**minor** bump on `main` every Monday and Wednesday 20:00 UTC and enables
auto-merge on the resulting `version-bump-*` PR (marked with the
`weekly-release-cut` label, which exempts it from the nightly stale-PR closer),
so once its checks pass the merge
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

The sheriff is a **fixed role**, declared in `.github/release-sheriff.json`:

```json
{ "sheriff": "thedatalife", "backupReviewer": "christian-byrne" }
```

It is deliberately not the Datadog on-call person. On-call pages for incidents
and hands over weekly; the sheriff shepherds releases through QA. Reading the
release owner off the paging rota is what coupled the two roles. Changing
sheriff is a PR to that file.

`backupReviewer` must name someone other than the sheriff, and
`parseSheriffConfig` fails the run if it does not — see below for why. Because
the unit suite runs on any change under `.github/`, a malformed or
self-naming edit fails CI on the PR that writes it.

If the file is missing or unreadable the run exits non-zero and assigns
**nothing**. There is no fallback on purpose: there is no sensible person to
guess at, and a bad declaration should not reach `main` in the first place.

`pr-assign-release-sheriff.yaml` assigns the release sheriff to any
open PR that has no assignee and is either:

- a backport (label `backport`, or a `[backport ...]` title);
- a release version bump (label `Release`, or a `version-bump-<version>`
  branch);
- opened by automation — `dependabot`, `comfy-pr-bot`, or `cloud-code-bot`.

It also requests their review, since backport merges are gated on an approval.
Existing assignees and review requests are never overwritten.

Both halves are **verified, not assumed**. GitHub drops an assignee who lacks
push access and still answers `201`, and rejects a review request for a
non-collaborator with `422`, so the job reads the assignee list back and checks
the review request succeeded. Either failure marks the run degraded and exits
non-zero rather than reporting a PR as owned when it is not — an unassigned
backport with no requested reviewer never reaches the approval
`backport-auto-merge.yaml` waits for.

When the sheriff wrote the PR themselves, the review is requested from
`backupReviewer` instead — GitHub rejects a self-review request, so previously
those PRs were assigned to their own author with nobody asked to review, and
then waited on an approval that had never been requested. That is also why
`backupReviewer` may not name the sheriff.

Automation-authored PRs are included because nobody feels addressed by what a
robot opens: they accumulated unassigned for weeks. Note these are matched by
author rather than by content, so a dependency bump counts as sheriff work.

It runs on PR events and hourly. Bot PRs are picked up by the hourly sweep
rather than on open — the `pull_request_target` gate matches labels, titles and
branches, and teaching it about bot logins would duplicate the author list in a
second syntax (the webhook says `dependabot[bot]` where `gh` says
`app/dependabot`), which would drift.

The job needs no secrets beyond the workflow's own `GITHUB_TOKEN` (and
`SLACK_BOT_TOKEN` for the failure alert). It previously read the Datadog
On-Call schedule and bridged Datadog emails to GitHub logins through the
`RELEASE_SHERIFF_DIRECTORY` secret, sourced from
`rosters/release-sheriff-directory.json` in `Comfy-Org/github-workflows-ops`.
All of that is gone: the sheriff is declared in this repo. `DATADOG_API_KEY`,
`DATADOG_APP_KEY` and `RELEASE_SHERIFF_DIRECTORY` can be deleted from the repo
secrets, and the roster file and its sync script retired.

## Publishing

Merged PRs with the `Release` label trigger `release-draft-create.yaml`,
publishing to GitHub Releases (`dist.zip`), PyPI (`comfyui-frontend-package`),
and npm (`@comfyorg/comfyui-frontend-types`).

## Weekly ComfyUI Integration

`release-weekly-comfyui.yaml` runs every Monday — if the next `core/`
branch has unreleased commits, it triggers a patch bump and drafts a PR to
`Comfy-Org/ComfyUI` updating `requirements.txt`.

## Workflows

| Workflow                         | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| `release-version-bump.yaml`      | Bump version, create Release PR                  |
| `release-draft-create.yaml`      | Build + publish to GitHub/PyPI/npm               |
| `release-branch-create.yaml`     | Create `core/` + `cloud/` branches (minor/major) |
| `release-weekly-comfyui.yaml`    | Weekly auto-patch + ComfyUI requirements PR      |
| `pr-backport.yaml`               | Cherry-pick fixes to stable branches             |
| `cloud-backport-tag.yaml`        | Tag cloud branch merges                          |
| `pr-assign-release-sheriff.yaml` | Assign the sheriff to backport/release/bot PRs   |
