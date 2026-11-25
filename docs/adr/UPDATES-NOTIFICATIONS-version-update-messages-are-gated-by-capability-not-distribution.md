# ADR-UPDATES-NOTIFICATIONS-version-update-messages-are-gated-by-capability-not-distribution: Version-update messages are gated by capability, not distribution

Date: 2026-11-19

## Status

Accepted

## Context

Three surfaces tell a user that a newer ComfyUI exists: the release toast, the
help-center red dot, and the "What's New" popup. All three were gated on
`isDesktop`, the compile-time `__DISTRIBUTION__ === 'desktop'` constant.

That constant no longer identifies the desktop product. The PyPI frontend
package is built by `pnpm build` with no `DISTRIBUTION` set
(`.github/workflows/release-pypi-dev.yaml`), so it is a `localhost` build; core
ships that package, and Comfy Desktop runs core. `dist-desktop.zip` is still
produced by `release-draft-create.yaml`, but only the legacy Electron app
consumes it. The practical effect was that no Comfy Desktop user and no local
install ever saw a version-update message, while Cloud — the one distribution
that is always current — saw the popup.

The cost is real. Across the installs that report a running core version, a clear majority are
more than one minor release behind, the typical lag is around two minors, and most of that
cohort does not change version at all over a month. The desktop repository separately found a
meaningful share of fresh installs silently staying on the bundled core.

Two product decisions govern the behaviour. The first defines three levels of update message,
_available_, _recommended_ and _critical_, in which the
`Comfy.Notification.ShowVersionUpdates` setting may mute release news but never a recommended or
critical update. The second narrows the immediate change to a default: the messages, not
auto-updates, should be on everywhere. This ADR implements the gating half of both. The
recommended and critical lanes are not built yet and are not muted today because they do not
exist.

## Decision

Gate each surface on what it can actually do, not on which bundle it was built
into.

- **Red dot** — shown on every distribution except Cloud. It is an indicator,
  it needs no host capability, and it fires on low-attention releases, which
  makes it the only surface that currently reaches a stale user. Cloud is
  always current, so an update indicator there is meaningless.
- **"What's New" popup** - shown on every distribution. It links only to the changelog, so it
  carries no host-specific action. It reports what the user just received and is, by
  construction, not an "update available" message.
- **Release toast** — still withheld outside the legacy desktop build. It is
  the only surface with an Update action, and that action is correct only where
  `Comfy-Desktop.CheckForUpdates` exists. Everywhere else it falls through to
  the generic OSS update docs, which are wrong guidance for a
  launcher-managed installation.

`Comfy.Notification.ShowVersionUpdates` keeps its existing `true` default and
continues to suppress every surface when a user turns it off.

Both ungated surfaces additionally require the running version and the release version to be
comparable semver, with one exception: Cloud keeps its existing bypass, because a Cloud
deployment has no meaningful `comfyui_version` and its popup must still appear. `compareVersions` otherwise treats any difference as newer and substitutes
`0.0.0` for a missing version, which behind the old desktop-only gate was unreachable in
practice. On a git install reporting a commit hash it would mean a permanent update dot, and a
popup showing release notes the user never received.

## Consequences

Local and Comfy Desktop installs now get a red dot when they are behind, and
the What's New popup after they update. Cloud behaviour is unchanged.

Ungating the toast needs two things outside this repository, both in hand.
The first is a host capability. `ComfyDesktop2Bridge` exposes no update
method, so the toast's action has nothing correct to call on Comfy Desktop.
The implementation already exists there, in `runComfyUIUpdate`; only the IPC
exposure and the bridge type are missing. When they land, the frontend must
probe that capability rather than branch on a build flag, which is the
mistake this ADR exists to undo.

The second is the toast's `hasMediumOrHighAttention` requirement, and it is
a deliberate product control rather than an oversight. Release notes are
drafted automatically and published at low attention on purpose, so that a
note no person has read cannot raise a pop-up. Someone raises the level by
hand for the releases that warrant one, which is why a single recent version
carries `high` while the rest, and every translation, carry `low`.

The consequence for this ADR is that the toast is rate-limited by an
editorial decision, not by a defect. It fires for the releases a human
judged worth interrupting for, and for no others. If the team later wants
automated notes to raise their own level, that is a decision for the owner
of that control, not a frontend change.

These surfaces are close to unmeasured. Neither the dot, the popup nor the toast emits an event
of its own, and the `Comfy.Release.Status` settings that record _skipped_ / _changelog seen_ /
_what's new seen_ are `type: 'hidden'`, which `settingStore.ts` excludes from
`app:setting_changed`. The one partial exception is the dot's destination: opening the help
centre and clicking a release in its What's New list are both reported, so some of the dot's
downstream effect is already visible. Impression and dismissal are not.

One consequence of keeping the toast gated: a low-attention dot clears itself after three days
only once `Comfy.Release.Status` is `skipped`, and only the toast writes that status. On every
newly ungated distribution such a dot therefore persists until the user opens the changelog.
That is accepted for now; giving these builds their own way to clear it belongs with the toast
work.

## Alternatives considered

**Remove the setting.** Proposed on the grounds that users who disable updates
leave the update funnel permanently. Rejected: the three-level model reaches
the same goal without taking the control away, since a setting that cannot mute
a recommended or critical update already prevents the stranding case. The
substitute offered for studios that need frozen versions — managed builds —
requires an admin publishing versions on a Comfy workspace, so a studio outside
one would lose version freezing and gain nothing.

**Source the default from a `show_version_updates` server feature flag,
defaulting off on local installs.** Implemented across
ComfyUI_frontend#13171, ComfyUI#14646 and Comfy-Desktop#1205. Rejected: it
inverts the product decision. The flag itself is a reasonable host suppression
lever and may return, but not as the thing that decides the default.

**Keep a distribution gate and widen it to Comfy Desktop.** Rejected: it
rebuilds the coupling between a build flavour and a host capability that caused
this, and ComfyUI_frontend#21213 is already retiring that constant in favour of
`isLegacyDesktopBuild` and `isComfyDesktop2`.
