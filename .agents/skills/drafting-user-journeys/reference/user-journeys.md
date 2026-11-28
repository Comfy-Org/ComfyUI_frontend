# User journeys

A journey set covers a change when every inventory line names a journey, an
existing test that already proves it, or a unit or component test that proves
it below the browser. Each journey can become one Playwright test.
[`example.md`](example.md) has a worked journey from PR #21612 and the test
outline it maps to. Read it before writing the first journey.

## 1. Group behaviors into journeys

Group the inventory into the fewest journeys a user would actually perform.
Chain behaviors that share a setup and follow each other naturally: open the
control, use it, cancel, undo. Split a journey when it needs a different
workflow, setting, or flag. A renderer difference that only changes how a step
is done (dragging a Vue slot dot versus a canvas slot) stays in one journey
run on both renderers.

Before adding a line to a journey, ask whether a Vitest test can prove it;
step math, store resets, and undo bookkeeping usually belong there. Keep a line in a
journey when only the browser shows it (canvas drawing, pointer gestures,
focus, a renderer difference), or when it costs one more step in a journey
that already exists. A line proven elsewhere names that test, by file and
test name, in the coverage table.

Grouping is done when every inventory line names a journey or a test in the
coverage table and no journey exists only to restate another with a different label.

## 2. Write each journey

Each journey has:

- A **title** in the imperative, naming what the user does: "Tidy nodes with reroutes, then cancel and undo".
- **Numbered steps**, three to five, each a user action. Name every UI label in bold (**Tidy up**, **Escape**, **Gap between nodes**). Take labels from `src/locales/en/*.json` or the rendered app; a guessed label fails the moment a test or a tester looks for it.
- An **expected result** after the step where it shows, written as what is on screen: "The gap returns to its previous width", not "the store resets".

Open each journey with a **Starts from** line before step 1: the workflow
asset (`default`, a file in `browser_tests/assets/`), each setting or flag it
needs, and the renderers it runs on. The line holds state only, no clicks. It
goes into the PR evidence block too, so a reader can replay the journey.

## 3. Map each journey to a Playwright outline

Find the spec that already opens the surface:
`rg -l '<label or component>' browser_tests/tests`. Extend that spec with a
new `test` or `describe` block; create a new spec only when no spec opens the
surface. Read `browser_tests/fixtures/` for the `comfyPage` helpers and page
objects each step will use, and name them in the outline.

Write the outline as the spec path, the `describe` it joins, the test name,
and bullets with exactly one action or expectation each. Group the bullets
under each journey step and wrap each group in a `test.step` titled with that
step's words, so the HTML report, the trace, and the PR evidence follow the
same numbering. Each expected result
in the journey becomes one assertion on something a user sees: a role-based
locator, `aria-valuenow`, visible text, a link count, a node position through
a node reference. A journey that runs on both renderers becomes one test
looped over `classic` and `vue`. The outline is done when every journey step
and expected result has a bullet.

## 4. Deliver

- **Playwright plan**: the coverage table and outlines.
- **PR evidence**: a `## User journeys` section with one `<details>` block per journey, the title as `<summary>`. `pr-evidence` adds the recording and test links under each block.
- **Linear ticket**: the journeys under the story whose criteria they prove, steps and expected results only.
