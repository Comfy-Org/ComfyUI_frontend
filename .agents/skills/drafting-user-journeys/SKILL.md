---
name: drafting-user-journeys
description: 'Drafts user stories, user journeys, and critical user journeys for a Comfy-Org/ComfyUI_frontend change, with journeys mapped to Playwright test outlines under browser_tests/. Use when planning a user-facing frontend feature, when a Linear ticket or PR needs user stories or journeys, when choosing which browser tests a change needs, or when a change touches a critical user journey or @smoke coverage.'
---

# Drafting user stories and journeys

Three artifacts, each answering a different question about the same change:

- A **user story** names a need: "As a workflow author, I want to tidy a selection so that its links stay readable." It says who and why, not how. Stories go in Linear tickets and feature plans.
- A **user journey** is one thing a user does from start to finish, step by step, such as "Cancel a gap preview and undo a held-arrow edit". Journeys become Playwright tests and PR evidence. One story usually needs one or more journeys to prove it.
- A **critical user journey** is a journey the suite promises to protect whatever the change: load a workflow, queue it, save and reopen it. A change either leaves each one working or updates its spec on purpose.

Here a journey is a user-journey test in Martin Fowler's sense: one path a
user takes through the app to reach a goal, with steps and observable
results. In Nielsen Norman Group's terms it is a user flow, not a journey
map: it has no personas, emotions, or touchpoints. The story names the user.

This skill chooses and words these artifacts. Neighbors own the rest:

- `.claude/skills/writing-playwright-tests/SKILL.md` and `browser_tests/README.md`: writing the spec.
- `docs/testing/unit-testing.md` and `docs/testing/component-testing.md`: proving a behavior below the browser.
- `docs/testing/e2e-coverage-strategy.md`: which journeys the suite treats as critical.
- `pr-evidence`: recording and publishing journeys as PR evidence.

## 1. Inventory the behaviors

Every artifact starts here. Read the source of the change: the diff against
the PR's real base branch, the Linear ticket, or the design. List each
behavior the change adds or alters as one line a user could observe: what
they do and what they see. Then add a line for each edge case the change
claims to handle, checking each of these:

- **Cancel**: Escape, clicking away, or closing mid-gesture restores the prior state.
- **Undo/redo**: one Undo reverses one user action; Redo restores it; a cancelled preview leaves no history entry.
- **Keyboard**: every pointer action that has a key equivalent (arrows, Shift+arrows, Home/End, Enter, held keys).
- **Read-only or pinned**: the canvas in read-only mode, pinned nodes, locked or disabled controls.
- **Failure**: each error, warning, or disabled state the change can show (a rejected queue, a missing node, an out-of-range value), and how the user gets back to work. Set up a server failure with `page.route`; the journey asserts only what the user sees.
- **Renderers**: each one the change touches, classic (LiteGraph canvas) and Vue nodes (Nodes 2.0).

Mark a code path that has no observable effect as internal and leave it out.
The inventory is done when no changed code path is unaccounted for, and each
edge case above has its own line or a reason it does not apply ("no keyboard
equivalent", "Vue renderer untouched").

## 2. Draft the artifacts the destination needs

Read the reference for each artifact you draft:

- A Linear ticket, or a plan for work still unbuilt: [`reference/user-stories.md`](reference/user-stories.md), then journeys for each story's acceptance criteria.
- Playwright coverage or PR evidence: [`reference/user-journeys.md`](reference/user-journeys.md).
- A change to a surface that a critical journey passes through, a feature reaching users through a flag flip, or a change to `@smoke` specs: [`reference/critical-user-journeys.md`](reference/critical-user-journeys.md), alongside the journeys.

Every destination gets a coverage table, behavior → story, journey, or test, so a
reviewer can see that each inventory line is covered.
