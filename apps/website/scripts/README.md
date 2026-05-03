# Website Scripts

## `refresh-ashby-snapshot.ts`

Pulls the latest job postings from Ashby and writes
`src/data/ashby-roles.snapshot.json`. Invoked by the `Release: Website`
GitHub Actions workflow; also runnable locally via
`pnpm --filter @comfyorg/website ashby:refresh-snapshot`.

## `process-videos.sh`

Generates multi-resolution VP9/WebM + H.264/MP4 variants and a poster
frame for marketing videos using `ffmpeg`. Run **locally** before
uploading the outputs to `media.comfy.org`; this is not wired into CI.

```sh
apps/website/scripts/process-videos.sh \
  ./video-sources \
  ./dist/videos \
  "640 960 1280 1920"
```

### Output

For each source video at `./video-sources/foo.mp4`, you get:

```
foo-640.webm   foo-640.mp4
foo-960.webm   foo-960.mp4
foo-1280.webm  foo-1280.mp4
foo-1920.webm  foo-1920.mp4
foo-poster.jpg
```

The naming convention is enforced by `buildVideoSources()` in
`src/utils/video.ts`, which the `<SiteVideo>` Vue component uses to
emit `<source>` URLs.

### Pairing with `<SiteVideo>`

Once the assets are uploaded, render them with:

```vue
<SiteVideo
  name="foo"
  base-url="https://media.comfy.org/website/marketing"
  :width="1280"
  :formats="['webm', 'mp4']"
  poster="https://media.comfy.org/website/marketing/foo-poster.jpg"
  autoplay
  loop
/>
```

### Encoder choices

- **VP9/WebM** at CRF 32 — preferred by Chrome and Firefox; smaller files.
- **H.264/MP4** at CRF 23, High profile, `+faststart` — universal fallback,
  required for Safari iOS.
- **Poster JPG** at q4 — extracted from t=1s, scaled to 1280w. Use this as
  the `poster` attribute so the video shows something while loading.

### Why a single resolution per video

`<source media="...">` inside `<video>` is unreliable across browsers
(Safari ignores it). The simplest correct strategy is to ship one
well-sized resolution and let CSS scale it down on smaller viewports.
The script generates multiple widths so you can pick a different one
per page (e.g. 1280w for a hero, 640w for a thumbnail), or wire up
JavaScript-based selection later if metrics demand it.
