# ADR-UPDATES-NOTIFICATIONS-0048: Version-update messages are gated by capability, not distribution

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

The cost is measurable. Of the installs that report a running core version,
59.4% are more than one minor behind, the median is two minors (about three
weeks of code), the largest single cohort is 180,314 users on a build that was
29 days old, and 85.1% of that stale cohort did not change version once in 30
days. Comfy-Desktop#1978 independently found about one in five fresh Desktop
installs silently staying on the bundled core.

Two decisions govern the behaviour. In `FAQs Messaging` (2026-10-21) the
product owner agreed a three-level model — _available_, _recommended_,
_critical_ — in which the `Comfy.Notification.ShowVersionUpdates` setting may
mute release news but never a recommended or critical update. In Slack
(2026-11-01) the decision was narrowed to a default: the messages, not
auto-updates, should be on everywhere. This ADR implements the gating half of
both; the recommended/critical lanes are not built yet and are not muted today
because they do not exist.

## Decision

Gate each surface on what it can actually do, not on which bundle it was built
into.

- **Red dot** — shown on every distribution except Cloud. It is an indicator,
  it needs no host capability, and it fires on low-attention releases, which
  makes it the only surface that currently reaches a stale user. Cloud is
  always current, so an update indicator there is meaningless.
- **"What's New" popup** — shown on every distribution. It links only to the
  changelog, so it carries no host-specific action. It is bounded by
  `isLatestVersion`: it reports what the user just received and is, by
  construction, not an "update available" message.
- **Release toast** — still withheld outside the legacy desktop build. It is
  the only surface with an Update action, and that action is correct only where
  `Comfy-Desktop.CheckForUpdates` exists. Everywhere else it falls through to
  the generic OSS update docs, which are wrong guidance for a
  launcher-managed installation.

`Comfy.Notification.ShowVersionUpdates` keeps its existing `true` default and
continues to suppress every surface when a user turns it off.

## Consequences

Local and Comfy Desktop installs now get a red dot when they are behind, and
the What's New popup after they update. Cloud behaviour is unchanged.

Ungating the toast needs two things that are not code in this repository. The
first is a host capability: `ComfyDesktop2Bridge` exposes no update or version
method, so Comfy Desktop must provide one before the toast's action can be
correct there, and the check must be a capability probe rather than a build
flag — the mistake this ADR exists to undo. The second is editorial: the toast
also requires `hasMediumOrHighAttention`, and every release in the live feed is
`attention: "low"`, so the toast would fire zero times even with a correct
action. Attention levels are a publishing practice, not a frontend change.

None of these surfaces emit telemetry, and the `Comfy.Release.Status` settings
that record _skipped_ / _changelog seen_ / _what's new seen_ are `type:
'hidden'`, which `settingStore.ts` excludes from `app:setting_changed`. The
effect of this change is therefore unmeasured until that is addressed.

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
