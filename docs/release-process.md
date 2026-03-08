# Release Process

How versions are bumped, branches are created, and artifacts are published.

## Version Semantics by Bump Type

All releases start from the same workflow (`release-version-bump.yaml`), but
the downstream effects differ based on bump type and target branch.

### Minor bump on `main` (new development cycle)

A minor bump **freezes** the previous minor into stabilization branches and
starts a new cycle.

```
main:  ──A──B──C──D──[bump to 1.42.0]──E──F──G── ...
                  │
                  ├── core/1.41  (branched from D)
                  └── cloud/1.41 (branched from D)
```

Commits A–D are the "1.41" work. E–G are new "1.42" development.

The `core/1.41` and `cloud/1.41` branches are created from the commit
**before** the version bump — they capture everything on `main` while it was
at `1.41.x`. This is why the branches are named after the *previous* minor:
they represent the **stabilized 1.41 release line**, not the new 1.42 cycle.

The v1.41.0 GitHub release is published and marked "latest". `core/` and
`cloud/` labels are created for backporting.

### Patch bump on `main` (daily snapshot)

A patch bump on `main` (e.g., `1.42.0` → `1.42.1`) simply publishes. **No
branches are created.** The GitHub release is published and marked "latest".

This is what the nightly cron does — it's a convenience snapshot of `main`.

### Patch bump on `core/X.Y` (hotfix)

A patch bump on a stable branch (e.g., `core/1.41` from `1.41.5` → `1.41.6`)
publishes a hotfix. **No branches are created.** The GitHub release is created
as a **draft** — it must be manually published with "Set as latest release"
**unchecked**, so `main` remains the "latest".

### Where the same commits end up

When a minor bump happens instead of a patch bump, the unreleased commits are
**dual-homed** — they appear in both places:

```
v1.40.1 ── A ── B ── C ── [bump to 1.41.0]
```

- **If this were a patch bump** (1.40.1 → 1.40.2): A, B, C become v1.40.2.
- **As a minor bump** (1.40.1 → 1.41.0): A, B, C become v1.41.0 on `main`,
  AND they sit on `core/1.40` where they could later ship as v1.40.2 via a
  patch bump on that branch.

This is intentional — `core/1.40` exists so ComfyUI can stay on the 1.40.x
line and receive patches without jumping to 1.41.

## Summary Table

| Bump | Target | New branches? | GitHub release |
|---|---|---|---|
| Minor | `main` | ✅ `core/` + `cloud/` for previous minor | Published, "latest" |
| Patch | `main` | ❌ | Published, "latest" |
| Patch | `core/X.Y` | ❌ | **Draft** (uncheck "latest") |
| Prerelease | any | ❌ | Draft + prerelease |

## Backporting

When a fix on `main` needs to go to a stable branch:

1. Add `needs-backport` + version label (e.g., `1.41`) to the merged PR
2. `pr-backport.yaml` cherry-picks the merge commit and creates a backport PR
3. If conflicts arise, the workflow comments with details and an agent prompt

## Publishing

Every merged PR with the `Release` label triggers `release-draft-create.yaml`:

| Channel | Package |
|---|---|
| GitHub Releases | `dist.zip` |
| PyPI | `comfyui-frontend-package` |
| npm | `@comfyorg/comfyui-frontend-types` |

## Bi-weekly ComfyUI Integration

`release-biweekly-comfyui.yaml` runs every other Monday:

1. Checks ComfyUI's `requirements.txt` for the current frontend version
2. If the next `core/` branch has unreleased commits, triggers a patch bump
3. Creates a draft PR to `Comfy-Org/ComfyUI` updating `requirements.txt`

## Workflow Reference

| Workflow | Purpose |
|---|---|
| `release-version-bump.yaml` | Bump version, create Release PR |
| `release-draft-create.yaml` | Build + publish to GitHub/PyPI/npm |
| `release-branch-create.yaml` | Create `core/` and `cloud/` branches (minor/major only) |
| `release-biweekly-comfyui.yaml` | Auto-patch + ComfyUI requirements PR |
| `pr-backport.yaml` | Cherry-pick fixes to stable branches |
| `cloud-backport-tag.yaml` | Tag cloud branch merges |
