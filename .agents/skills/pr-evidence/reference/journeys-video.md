# User journeys with demo video

For feature and behavior PRs. A **journey** is one thing a user does from
start to finish, such as "Cancel a gap preview and undo a held-arrow edit".
Each journey gets one `<details>` block, one passing Playwright test, and one
inspected clip.

## Draft the journeys and specs

Load `drafting-user-journeys` and draft the journeys from the diff: every
behavior the diff changes appears in its coverage table, covered by a
journey or by the lower-level test the table names, and each journey maps
to a Playwright test whose steps match its numbered steps. Only journeys get
a recording. Commit any
new or extended spec with the PR, since it doubles as the regression test.
Each test passes locally before you record it.

## Record

```sh
RECORD_VIDEO=true pnpm test:browser:local <spec> --project=chromium -g "<test title>"
```

Add `SLOW_MO=600` when the steps go by too fast to follow. Find the output
with `rg --files -g '*.webm' test-results` and match it to the test by
directory name.

## Trim and convert

Find where the loading screen ends: build a tile sheet and read the first
frame that shows the workflow.

```sh
scripts/media.sh tiles test-results/<dir>/video.webm /tmp/tiles.png
scripts/media.sh clip test-results/<dir>/video.webm <start-seconds> /tmp/evidence/<journey-slug> [end-seconds]
```

`clip` writes `<journey-slug>.mp4` (H.264, `-crf 20`, `yuv420p`,
`+faststart`) and `<journey-slug>.gif`, a looping preview under 5 MB for
places that do not play video, such as Slack or Linear. An MP4 over 10 MB is re-encoded in
place by `shrink` (CRF 26, then 28, then 1280px wide, then 15 fps); when
even the last step is over, `clip` fails and the fix is a shorter trim. Run
`scripts/media.sh shrink <in.mp4> <out.mp4>` on any other video that needs it.
The tile sheet covers 30 frames, so
for longer clips pass a lower fps such as `0.5`.

## Inspect

Write the expected result for each clip before you look, such as "the gap
returns to its earlier width after Escape, near the 4s mark", then watch the
clip against it. When the answer is ambiguous, build a tile sheet of the
trimmed MP4 and read the frames. A clip that misses its expected result means the
feature, the test, or the trim is wrong: fix it and record again.

## Block format

The video link sits alone on its line, which is what makes GitHub render a
player; the Playwright link goes on the next
line.

```markdown
<details>
<summary>Cancel a gap preview and undo a held-arrow edit</summary>

1. Open **Tidy up** for two notes. Drag the gap handle and press **Escape**.
2. Focus the handle, hold **Up Arrow**, then press Undo.

Expected: Escape restores the layout, and one Undo reverses the whole held-arrow edit.

[Demo: cancel and undo](./cancel-undo.mp4)

[Playwright](https://github.com/<owner>/<repo>/blob/<sha>/browser_tests/tests/<spec>.ts#L186-L277)

</details>
```

Steps use the UI's own labels in bold. The Playwright link points at the
pushed commit that contains the test, with the test's line range.
