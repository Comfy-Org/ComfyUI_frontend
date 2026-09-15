# Learnings — media-source-retry-on-fail

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## Todo 1: retryable media source

- Consumers should bind media elements to the readonly `src` ref and forward
  each element's error event to `onError`. Duplicate errors are ignored while
  the shared source is already retrying or has failed.
- A scheduled retry leaves the current URL bound during its delay, then emits
  `undefined` for one Vue tick before re-emitting the latest source. Failed
  state also keeps the URL bound so consumers can render overlays in place.
- Source changes bind synchronously, cancel pending retries, and restore the
  five-attempt budget. `retry()` immediately performs the same one-tick source
  cycle and resets the next automatic delay to 500 ms.
- The full automatic sequence is the initial load plus retries after 500,
  1000, 2000, 4000, and 8000 ms. The next consecutive error sets `failed`.

## Todo 2: video source retry integration

- The source-store watch getter returns `[]` when no source resolves. Otherwise
  its dependencies are `[outputs, previews, fileWidgetValue]`; element 0 is the
  `nodeOutputs[locatorId]` object, whose identity changes on execution but stays
  stable when `connectionVersion` alone changes.
- `useVideoSourceUrl` now returns `{ videoUrl, status, onError, retry }` from the
  retryable source wrapper. `videoUrl` is its readonly emitted `src`, while the
  existing resolution logic writes to the internal `resolvedUrl` ref.
- Replacing the output object with an identical resolved URL calls `retry()` to
  cancel a pending timer, reset the 500 ms budget, and force one reload cycle.
  A connection-only recomputation does not call it.

## Todo 3: VideoEditPanel gate/src split

- Exact contract todo 4 must wire onto `<VideoEditPanel>`:
  - prop `hasSource?: boolean` (default `false`) -> template `:has-source="hasSource"`
  - emit `loadError: []` (no payload) -> template `@load-error="onError"`
  - the pre-existing `retry: []` emit and `videoUrl?: string` prop are unchanged.
- `hasSource` now drives every mount gate and both widget `disabled` options;
  `videoUrl` survives in exactly two places: `:src="videoUrl"` on the `<video>`
  and `watch(toRef(() => videoUrl), ...)`. A `hasSource: true` panel with
  `videoUrl: undefined` renders the player with an unset `src`, which is what
  makes the composable's one-tick `undefined` step non-destructive.
- That watch now fires on both steps of every reload cycle, resetting the
  playhead to `startFrame` (trim) or 0 and clearing `isPlaying` and the cached
  intrinsic size. Intended: a reloading element has no decoded frames.
- Test helper `renderPanel` defaults to `hasSource: true` alongside its default
  `videoUrl`. The two empty-state cases pass `{ videoUrl: undefined,
hasSource: false }`; passing only `videoUrl: undefined` now leaves the player
  mounted, so any new no-source case must set both.
- No test in this file pins gate-vs-src decoupling on its own (both empty-state
  cases keep the two props in agreement). That regression is caught by F2's
  `rg 'v-if="videoUrl"' src/` sweep and by todo 4's `gates the panel on the
source status` case -- do not drop either.
- `pnpm lint` shells out to a nested bare `pnpm`; under nix-only PATH use a
  shim (`exec corepack pnpm "$@"`) on PATH or the script dies with
  `pnpm: command not found` before ESLint runs.
- Flagged, not fixed: `VideoEditPanel.vue` is 479 pure LOC (475 before this
  todo), well past the 250 ceiling. Splitting it is out of scope here (todo 4
  builds on its current shape) and belongs in a follow-up.

## Todo 6: list-view video thumbnail (`AssetsListItem.vue`)

- The mount gate stays on the raw `previewUrl` prop; only the `<video>` and
  `VideoPlayOverlay` are gated on `videoStatus !== 'failed'`, with the
  `icon-[lucide--video-off]` fallback as a sibling inside the same clickable
  div. `preview-click` keeps firing in the failed state because the click
  handler never moved.
- The clickable div is `relative size-full`, not a flex container, so the
  fallback icon needs `absolute inset-0 m-auto` to sit centred in the 32 px
  tile. Adding flex utilities to the wrapper instead would have reflowed the
  existing `<video>`/`<img>` children.
- `useRetryableMediaSrc(() => (isVideoPreview ? previewUrl : undefined))`
  works directly off reactive prop destructuring — no extra `computed`.
- Component-level retry tests: fake timers are already global
  (`vitest.timer.setup.ts`, `shouldAdvanceTime: true`), so `userEvent.setup()`
  still works and no per-file `vi.useFakeTimers()` is needed. Drive the retry
  with `fireEvent.error(video)` then `await vi.advanceTimersByTimeAsync(delay)`
  plus one `await nextTick()` for the composable's one-tick source cycle.
- Asserting only "the video still has a src" after one error passes against
  the pre-fix markup too, so it proves nothing. A `MutationObserver` on the
  `src` attribute records the `[null, url]` cycle and is genuinely red before
  the change; both new tests were verified red against the old template.

## Todo 5: gallery card video (`MediaVideoTop.vue`)

- Fake timers are already installed per-test by `vitest.timer.setup.ts`
  (`vi.useFakeTimers()` in a global `beforeEach`, `useRealTimers` in
  `afterEach`), configured in `vite.config.mts:825` with
  `{ now: TEST_SYSTEM_TIME, shouldAdvanceTime: true }`. A per-file
  `vi.useFakeTimers()` is redundant, and a per-file `afterEach(() =>
  vi.useRealTimers())` is an oxlint **error**
  (`comfy(no-redundant-vitest-cleanup)`), not a warning — it fails `pnpm lint`.
  Just call `vi.advanceTimersByTimeAsync(delay)` directly.
- `$t` in the template needs a local mock: `const globalConfig = { mocks: { $t:
  (key: string) => key } }` passed as `global: globalConfig` to **every**
  `render(...)` in the file — no global Vitest setup installs i18n, so a render
  that omits it throws. Assert on the raw key (`'g.videoFailedToLoad'`).
- Swapping `<source>` for `:src` means the `<video>` element identity survives
  the composable's one-tick `undefined` -> url cycle (the `v-if` gate stays
  true throughout a retry), so a `video` reference captured before
  `fireEvent.error` is still valid after `advanceTimersByTimeAsync`. No
  `MutationObserver` needed here: gating the element on `status !== 'failed'`
  makes "still in the document after one error" a genuinely red assertion if
  the gate is wrong. Both new tests were verified red (unwiring `@error`
  reddens the failed-state test; narrowing the gate to `status === 'loading'`
  reddens the reload test).
- `asset.src` is a required `z.string().url()` (`mediaAssetSchema.ts:27`), but
  the existing test passes `''` for "no source", so the getter must be
  `() => asset.src || undefined` — `?? undefined` would bind an empty string
  and put the composable in `loading` with no URL.
- Use `size-8` on the `icon-[lucide--video-off]` fallback. `MediaAudioTop.vue`
  and `MediaImageTop.vue` size their icons with `text-3xl`; both are
  pre-existing AGENTS.md violations (font-size classes do not size iconify
  icons predictably, they render at `1.2em`). Do not copy them.
