# Release Process

## Bump Types

All releases use `release-version-bump.yaml`. Effects differ by bump type:

| Bump       | Target     | Creates branches?                     | GitHub release               |
| ---------- | ---------- | ------------------------------------- | ---------------------------- |
| Minor      | `main`     | `core/` + `cloud/` for previous minor | Published, "latest"          |
| Patch      | `main`     | No                                    | Published, "latest"          |
| Patch      | `core/X.Y` | No                                    | **Draft** (uncheck "latest") |
| Prerelease | any        | No                                    | Draft + prerelease           |

**Minor bump** (e.g. 1.41→1.42): freezes the previous minor into `core/1.41`
and `cloud/1.41`, branched from the commit _before_ the bump. Nightly patch
bumps on `main` are convenience snapshots — no branches created.

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
open backport PR (label `backport`, or "backport" in the title) and any
release version-bump PR (label `Release`, or a `version-bump-*` branch) that
has no assignee. It also requests their review, since backport merges are
gated on an approval. Existing assignees and review requests are never
overwritten.

It runs on PR events and hourly — the hourly sweep is what catches strays that
were opened while nobody was looking.

The rotation itself lives in Datadog On-Call and is read at execution time, so
handovers need no commit. `.github/release-sheriff.json` supplies the schedule
and the Datadog-email → GitHub-login mapping:

| Field                 | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `datadog.site`        | Datadog site host, e.g. `datadoghq.com`              |
| `datadog.scheduleId`  | On-Call schedule holding the sheriff rotation        |
| `githubLoginByEmail`  | Datadog user email → GitHub login (one per sheriff)  |
| `fallbackGithubLogin` | Used when Datadog is unreachable or user is unmapped |

Requires repo secrets `DATADOG_API_KEY` and `DATADOG_APP_KEY` (scope:
`on_call_read`). Without them — or with an empty `scheduleId` — the workflow
still runs and falls back to `fallbackGithubLogin`, logging a warning.

## Publishing

Merged PRs with the `Release` label trigger `release-draft-create.yaml`,
publishing to GitHub Releases (`dist.zip`), PyPI (`comfyui-frontend-package`),
and npm (`@comfyorg/comfyui-frontend-types`).

## Bi-weekly ComfyUI Integration

`release-biweekly-comfyui.yaml` runs every other Monday — if the next `core/`
branch has unreleased commits, it triggers a patch bump and drafts a PR to
`Comfy-Org/ComfyUI` updating `requirements.txt`.

## Workflows

| Workflow                         | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| `release-version-bump.yaml`      | Bump version, create Release PR                  |
| `release-draft-create.yaml`      | Build + publish to GitHub/PyPI/npm               |
| `release-branch-create.yaml`     | Create `core/` + `cloud/` branches (minor/major) |
| `release-biweekly-comfyui.yaml`  | Auto-patch + ComfyUI requirements PR             |
| `pr-backport.yaml`               | Cherry-pick fixes to stable branches             |
| `cloud-backport-tag.yaml`        | Tag cloud branch merges                          |
| `pr-assign-release-sheriff.yaml` | Assign on-call sheriff to backport/release PRs   |
