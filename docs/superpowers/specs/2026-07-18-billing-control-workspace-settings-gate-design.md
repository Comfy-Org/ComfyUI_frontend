# Billing-Controlled Workspace Settings UX

## Goal

Make `billing_control_enabled` the single rollout boundary between the existing
workspace settings experience and the new billing controls experience introduced
by PR #13644.

- Flag off keeps the current production workspace settings UX intact.
- Flag on exposes the new Plan & Credits, Activity, and separate Members UX.
- A live flag change always leaves the settings dialog on a valid panel.

## Non-goals

- Changing backend billing APIs or feature-flag delivery.
- Renaming the existing external `workspace` settings key.
- Persisting billing-banner dismissal across workspaces or browser sessions.
- Addressing optional style or refactor suggestions unrelated to the rollout
  boundary.

## UX contract

The workspace settings shell remains eligible only when team workspaces are
enabled and the user is logged in. Within that eligible state,
`flags.billingControlEnabled` selects the entire UX:

| State    | Sidebar        | `workspace` content                                                   | Additional panel                              |
| -------- | -------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| Flag off | Workspace      | Existing `WorkspacePanelContent` with Plan & Credits and Members tabs | None                                          |
| Flag on  | Plan & Credits | New Plan & Credits content with Credits and Activity sections         | Separate Members panel at `workspace-members` |

Flag-off behavior also preserves the existing building icon and the standalone
Credits item shown when `subscription_required` is false. Flag-on behavior uses
the receipt icon for Plan & Credits and the users icon for Members. Activity and
the `workspace-members` sidebar entry must not be reachable while the flag is
off.

The `workspace` key remains stable in both modes so existing deep links continue
to work. When the flag is on, that key resolves to the new Plan & Credits view.

## Component design

`useSettingUI` gates the complete workspace navigation and panel registry directly
on `flags.billingControlEnabled`. It must not infer the rollout from billing type
or API response shape.

`WorkspacePanelContent.vue` and its tests remain as the flag-off fallback. The
new flag-on entries share one workspace settings shell component. The shell takes
a section prop such as `planCredits` or `members`, renders the common billing
status banner once, and selects the corresponding body.

Both flag-on registry entries use the same async component object with different
section props. Switching between Plan & Credits and Members therefore updates the
prop without replacing the shell, keeping the banner mounted and preserving its
in-memory dismissed state. This avoids making dismissal global, which could leak
state between workspaces.

## Live rollback

Remote configuration can change while the dialog is open. If
`billing_control_enabled` changes from true to false while `workspace-members` is
active, the settings dialog immediately selects the stable `workspace` key. The
dialog must never render an empty panel because its active key disappeared.

The same navigation guard should validate the active key whenever the available
panel registry changes and choose a valid fallback without changing unrelated
settings behavior.

## Regression coverage

Behavioral tests cover both sides of the flag boundary:

- `useSettingUI.test.ts` verifies the flag-off Workspace entry, old component,
  icon, standalone Credits behavior, and absence of Members/Activity navigation.
- `useSettingUI.test.ts` verifies the flag-on Plan & Credits and Members entries,
  icons, stable `workspace` deep link, and new shell selection.
- `WorkspacePanelContent.test.ts` remains in place and verifies the old Plan &
  Credits and Members tabs, absence of Activity, and shared billing banner.
- New-shell component tests verify Credits/Activity and Members content and prove
  that one banner instance survives section switching.
- Settings-dialog coverage verifies that disabling the flag while
  `workspace-members` is active falls back to `workspace` instead of showing a
  blank panel.
- Browser tests that exercise Plan & Credits or the separate Members entry set
  `billing_control_enabled: true` explicitly. At least one browser regression
  test sets it to false and verifies the legacy Workspace UX with no Activity or
  separate Members entry.

## Review feedback scope

Only required, behavior-affecting CodeRabbit feedback is included in this fix
round:

- Preserve controlled and uncontrolled open state in `HoverCard.vue` and cover
  both behaviors.
- Forward trigger props through `useForwardProps` in `HoverCardTrigger.vue`.
- Sort workspace activity numeric details numerically, with a regression test.
- Use a function declaration in the Storybook current-user mock.

Optional pagination, ellipsis styling, duplicate alias, and empty logged-out
navigation suggestions remain out of scope. The pre-existing Members promise
pattern is also unchanged unless the flag work directly requires touching it.

## Rollout and validation

The implementation first merges the latest `main` into the PR branch, resolves
conflicts without weakening the flag boundary, and updates the PR description to
state that the old panel remains the flag-off fallback and the whole new workspace
settings shell is gated.

Validation includes focused unit/component tests, affected Playwright tests,
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm knip`, and browser test
type checking when browser TypeScript changes. The branch is pushed only after
the flag-off and flag-on behavioral matrix passes.
