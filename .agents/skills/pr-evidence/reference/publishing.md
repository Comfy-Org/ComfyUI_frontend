# Publishing evidence to the PR body

## Layout

The existing body stays as written: its summary and verification sections
remain visible. Evidence goes in one section appended after them, between a
marker and a closing comment, with every capture, clip, table, and diagram
inside a `<details>` block:

```markdown
<!-- pr-evidence before=<merge-base or main sha> after=<head sha> -->

## Evidence

Before: [`abc1234`](https://github.com/<owner>/<repo>/commit/<full sha>) · After: [`def5678`](https://github.com/<owner>/<repo>/commit/<full sha>)

<details>...</details>

<!-- /pr-evidence -->
```

On a refresh, replace only the text between the two comments. When the body
already has an evidence or user-journeys section written by hand, put the
blocks there and add the marker above it instead of adding a second section.

Pin every spec, source, and commit link to a full SHA, with a line range for
specs: `https://github.com/<owner>/<repo>/blob/<sha>/<path>#L10-L20`. A link
to a branch moves when the branch does.

## Hosting media

### Primary: GitHub attachments

Requires `gh` 2.99.0 or later; check with `gh version` and upgrade from
https://cli.github.com when it is older.
`gh pr edit --attach` uploads
images and video to `https://github.com/user-attachments/assets/<uuid>`,
which GitHub renders inline. Tested on gh 2.99.0:

- References already in the body are rewritten to the uploaded URL when
  they are Markdown images `![alt](./x.png)` or links `[text](./x.mp4)`. Write
  the draft with those references, then upload and save it in one command:

  ```sh
  gh pr view <n> --json body --jq .body > /tmp/body.md   # fresh copy, then add the section
  gh pr edit <n> --body-file /tmp/body.md --attach ./menu-before.png --attach ./menu-after.png --attach ./journey.mp4
  ```

- A bare path line (`./x.mp4`) or a `<video src="./x.mp4">` tag is not
  rewritten; the upload is appended as a bare URL at the end of the body.
  Without a body flag, every upload is appended at the end. Move appended
  lines into their `<details>` blocks and save again.
- A video URL renders as a player when it is the only content of its
  paragraph, as a bare URL or as a lone `[text](url)` link. On a line with
  other links it renders as a plain link. A `<video>` tag renders, but with
  extra markup; leave it out.
- MP4 (H.264) and WebM both play; use MP4 for browser compatibility.
- Limits from GitHub's docs: 10 MB per image or GIF; 10 MB per video on
  free plans and 100 MB on paid plans. A 17 MB MP4 uploaded to a free-plan
  private repo without error, but keep clips under 10 MB to stay inside the
  documented limit; `scripts/media.sh shrink` gets them there.
- Alt text after `#` applies to images only; video has none.
- Animated WebP uploads and is served unchanged as `image/webp`, about
  2.4× smaller than the same GIF. GitHub marks only GIFs as animated
  images, which gives them its pause control, so previews stay GIF.
- On a partial failure the command exits non-zero and keeps the uploads
  that succeeded. Read the body back before retrying so nothing uploads
  twice.

### Without `--attach`

When `gh` cannot be upgraded, drag the files into the PR description in
GitHub's editor. It uploads them to the same `user-attachments` URLs; move
each URL into its `<details>` block and save.

## Write the body

Make the final edit with the REST API so the body comes from a file
verbatim:

```sh
gh api --method PATCH repos/<owner>/<repo>/pulls/<n> -F body=@/tmp/body.md --jq .html_url
```

Fetch the body again right before each write and merge your section into
it. This narrows the window for losing someone else's edit but does not close
it: the PATCH replaces the whole body, so an edit saved between the fetch and
the PATCH is overwritten.

## Read back

```sh
gh api repos/<owner>/<repo>/pulls/<n> --jq .body > /tmp/posted.md
rg -o '<details>' /tmp/posted.md | wc -l; rg -o '!\[' /tmp/posted.md | wc -l; rg -o 'https://[^) "]+' /tmp/posted.md | sort | uniq -c
```

Done means:

- The `<details>`, image, and per-URL link counts match the draft.
- Every `user-attachments` URL sits inside a `<details>` block, and no
  local `./` path is left.
- Every media URL returns HTTP 200. Private-repo attachments return 404
  without auth, so check them with
  `curl -sL -o /dev/null -w '%{http_code}' -H "Authorization: token $(gh auth token)" <url>`.
- The marker names the SHAs the evidence is valid at: each block was
  captured there, or the stale check below confirmed none of its files
  changed since its capture. Every capture comes from a clean checkout at
  the SHA it was taken at (`git status --short` empty apart from a copied
  story in the before worktree).

## Stale evidence

Run this on every follow-up round, before recapturing anything.

1. Read the marker: `rg -o 'pr-evidence before=\S+ after=\S+' /tmp/posted.md`.
   A body with evidence but no marker is stale.
2. List the files the evidence depends on: the components and styles
   captured, the specs recorded, their fixtures, and the code a benchmark
   runs.
3. Fetch, then diff each side, treating an unreachable SHA as moved:

   ```sh
   git diff --name-only <after> <head> -- <paths>
   git diff --name-only <before> "$(git merge-base origin/main <head>)" -- <paths>
   ```

   Use `origin/main` in place of the merge-base when the before capture
   came from main.

4. Any listed file means that side is stale. Recapture only the affected
   blocks, replace them, and update the marker. When nothing is listed,
   update only the marker's SHAs.
