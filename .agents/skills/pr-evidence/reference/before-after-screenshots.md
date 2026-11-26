# Before/after screenshots

For visual and component PRs. Each **state** a reviewer must judge gets a
before image and an after image, captured under identical conditions and
shown side by side in a Markdown table.

## Pick the states

For every component the diff changes, list the states it can render and
keep those the diff affects: light and dark theme, then loading, error,
empty, hover, focus, open menu or popover, disabled, and any size variant.
A state you skip needs a reason, such as "no dark-theme styles changed".

## Set up both sides

- **After**: the PR branch at its pushed head.
- **Before**: a temporary worktree at the merge-base, or at `main` when the
  PR is meant to compare against current main:

  ```sh
  git worktree add /tmp/pr-before "$(git merge-base origin/main HEAD)"
  (cd /tmp/pr-before && pnpm install --frozen-lockfile)
  ```

Run Storybook on both sides on different ports: `pnpm storybook` on the
branch (port 6006), and `pnpm exec storybook dev -p 6007 --ci` in the
worktree. When the component has no story, add one in the PR, following
`.claude/skills/writing-storybook-stories/SKILL.md`, since it also serves
later reviews. When the story is new in this PR, copy it into the worktree
for the before capture. When the state only exists inside the running app, such as a
canvas interaction, use the dev server on both sides with the same workflow
file instead.

## Hold everything identical

Both sides use the same story or fixture, story args, theme, viewport, and
interaction sequence. Capture at 2x device pixel ratio with
`prefers-reduced-motion: reduce` emulated, so animations do not land on
different frames. Load the story through its iframe URL
(`/iframe.html?id=<story-id>&viewMode=story`), and set the theme the way the
repo's `.storybook/preview` reads it. For hover and menu states, drive the
same element with the same action on both sides and wait for the same
element to appear before capturing. Crop both sides to the same region.

When the change is about click targets, outline the hit regions on both
sides with the same colors and name them in the block, such as "Blue is the
add-slot hit rect; red is the resize handle." Measure the overlap or
clearance and state the numbers.

## Inspect

Save the two sides as separate files with the same crop and size, such as
`/tmp/evidence/<state-slug>-before.png` and `<state-slug>-after.png`.
Open both files of each pair and check them against the expected
difference, such as "verify the after menu items are 4px taller
and the before menu is otherwise identical". A pair that differs in
anything beyond the change, such as fonts, data, scroll position, or theme,
is recaptured.

## Block format

```markdown
<details>
<summary>Node context menu, dark theme, open</summary>

Components: `NodeContextMenu`, `MenuItem`

| Before                                                                                | After                                                                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| ![Before: the dark context menu with the old row height](./menu-dark-open-before.png) | ![After: the dark context menu with taller rows and the new divider](./menu-dark-open-after.png) |

</details>
```

Each alt text starts with "Before:" or "After:" and names what that side
shows, so the pair reads correctly without the images. Equal crops keep the
two columns the same width.

Remove the worktree when done. A copied story leaves it unclean, so check
`git -C /tmp/pr-before status --short` lists only that story and capture
output, then run `git worktree remove --force /tmp/pr-before`.
