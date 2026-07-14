# 12. Cloud Release Notes Use the ComfyUI Version

Date: 2026-07-13

## Status

Accepted

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

The release-note system (`releaseStore`) decides whether to surface new-release
UI — the desktop toast/red-dot and the "what's new" popup — by comparing the
version of the most recent entry in the `/releases` feed against the version the
user is currently running.

`currentVersion` sourced that "current version" differently per platform:

- on Cloud, from `system_stats.system.cloud_version`,
- everywhere else, from `system_stats.system.comfyui_version`.

The `/releases` feed, however, is authored in the docs repo and its entries are
keyed by **ComfyUI** version for every project, including `project: 'cloud'`.
There is no separate cloud-versioned feed, and the "learn more" link on every
release note points at <https://docs.comfy.org/changelog>, which only lists
ComfyUI versions.

This mismatch broke the feature on Cloud (tracked as **FE-1237**):

- Cloud runs a much higher `cloud_version` (e.g. `0.160.1`) than the ComfyUI
  version the feed entries carry (e.g. `0.27.1`).
- The comparison therefore resolved as `0.27.1 < 0.160.1` → "already ahead of
  the latest release" → the popup's `isLatestVersion` gate never passed and the
  popup never showed.
- Analytics confirmed the regression: `release_note` clicks fell from 13.4% of
  clicks over 90 days to 0% over 30 days, and `cloud_release_note` was
  effectively never clicked.

Two directions could fix the mismatch:

1. Give Cloud its own cloud-versioned release feed and a cloud changelog page.
2. Compare against the ComfyUI version on Cloud too, so the running version and
   the feed entries share the same version namespace.

Option 1 requires infrastructure that does not exist: no cloud changelog page,
and in current practice a single person maintains the changelog in the docs
repo using ComfyUI versions, updated after each Cloud deploy completes. A
cloud-versioned popup would deep-link users to a changelog page that has no
matching entry, which is more confusing than the version label itself.

## Decision

`currentVersion` always uses `comfyui_version`, on Cloud as well as everywhere
else. `cloud_version` is no longer consulted for release-note version
comparisons.

The `/releases` request still sends `project: 'cloud'` on Cloud, so Cloud can
receive a curated subset of release notes; only the version used for comparison
changes.

## Consequences

- Cloud shows a release note once the running ComfyUI version matches the latest
  published feed entry — consistent with the practice of updating the changelog
  after a Cloud deploy lands. Publishing a note for a version Cloud has not yet
  deployed correctly withholds the popup until the deploy catches up.
- The popup and its "learn more" link now reference a ComfyUI version that
  actually exists on the changelog page.
- `cloud_version` remains available in `system_stats` for other consumers; this
  decision scopes only to release-note version comparison.
- If Cloud later wants release notes tied to its own versioning, it would need a
  cloud-versioned feed **and** a cloud changelog page, at which point this ADR
  should be revisited.
