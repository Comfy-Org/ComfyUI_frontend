# User stories

A story records one need before anyone decides how the UI meets it. Write
one when the work is still a plan: a Linear ticket, a feature proposal, or a
split of a large feature into tickets. A story is a first draft for a
conversation with the owner, not a contract.

## When a story is the wrong form

Write a story only for a need a user can observe. A defect in existing
behavior gets the bug form: expected behavior, actual behavior, steps to
reproduce. An internal change (a refactor, a store migration, a dependency
upgrade) gets a plain technical item: why it matters and what must be true
when it is done, with no invented user.

## Format

> As a **<user>**, I want **<action>** so that **<outcome>**.

- **User**: a concrete ComfyUI user, named by what they are doing: a workflow author, someone running a shared workflow, a custom-node developer, a Cloud subscriber. A story whose user is "the user" or "a developer" has not picked who it serves.
- **Action**: what they want to do, in product words, without the control that will do it. "Even out the gaps between selected nodes", not "drag the gap handle".
- **Outcome**: why the user wants it. A story whose outcome restates the action ("so that the gaps are even") has no reason yet; ask why the user wants it. If the action would not actually deliver the outcome, another story is missing. The outcome says why; the acceptance criteria say when the story is done.

## Acceptance criteria

Under each story, list the criteria as observable checks, each one a line a
tester or a Playwright assertion could confirm: "Escape during a drag leaves
the layout as it was." Draw them from the step 1 inventory; each inventory
line belongs to exactly one story. A criterion may cover several lines that
are variants of one rule (pointer and keyboard, both renderers); the journeys
spell out the variants. More than about six criteria usually means the story
holds two needs: split it.

When journeys exist, name the journey that proves each criterion. A criterion
no journey reaches names the test that proves it below the browser, or
needs a journey.

Under the criteria, add two short lists when they have entries:

- **Out of scope**: behavior a reader might expect this story to change that it leaves alone.
- **Open questions**: anything the ticket, design, or diff leaves undecided, phrased as a question for the owner. Leave each one open; a criterion that settles it skips the conversation the story exists for.

## Splitting

One story per need. Split a story when its criteria serve two users or two
outcomes, or when one half can be built, tested, and demonstrated without the
other. Cut each split through the whole stack so a user can do something at
the end of it, rather than into store, composable, and component tickets, or
into "build it" and "test it". Axes that split well here:

- **Paths**: alternate ways to one result (pointer, keyboard, context menu).
- **Interface**: one renderer first when the other ships behind a flag.
- **Data**: plain nodes before groups, subgraphs, or reroutes.
- **Rules**: the plain case before read-only or pinned handling.

Order the stories so the first is the thinnest one a user can complete end to
end. Keep a story whole when splitting would leave a half no user would
notice.

## In a Linear ticket

Put the stories and criteria where the ticket format places acceptance
criteria; the rest of the ticket follows its team's template. Keep the journeys in
the ticket only when the work is ready to build, and link the PR's
"User journeys" section once it exists.
