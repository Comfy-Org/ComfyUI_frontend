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

The minor bump is scheduled automatically: `release-version-bump.yaml` runs a
**minor** bump on `main` every Monday 20:00 UTC and enables auto-merge on the
resulting `release-weekly-cut-*` PR, so once its checks pass the merge triggers
`release-branch-create.yaml` and the `core/` + `cloud/` cut is hands-off. The
separate nightly `0 0 * * *` cron stays a **patch** bump.

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

## Publishing

Merged PRs with the `Release` label trigger `release-draft-create.yaml`,
publishing to GitHub Releases (`dist.zip`), PyPI (`comfyui-frontend-package`),
and npm (`@comfyorg/comfyui-frontend-types`).

## Weekly ComfyUI Integration

`release-biweekly-comfyui.yaml` runs every Monday — if the next `core/`
branch has unreleased commits, it triggers a patch bump and drafts a PR to
`Comfy-Org/ComfyUI` updating `requirements.txt`. (Filename retains the
`biweekly` name for run history; the cadence is now weekly.)

## Workflows

| Workflow                        | Purpose                                          |
| ------------------------------- | ------------------------------------------------ |
| `release-version-bump.yaml`     | Bump version, create Release PR                  |
| `release-draft-create.yaml`     | Build + publish to GitHub/PyPI/npm               |
| `release-branch-create.yaml`    | Create `core/` + `cloud/` branches (minor/major) |
| `release-biweekly-comfyui.yaml` | Weekly auto-patch + ComfyUI requirements PR      |
| `pr-backport.yaml`              | Cherry-pick fixes to stable branches             |
| `cloud-backport-tag.yaml`       | Tag cloud branch merges                          |
