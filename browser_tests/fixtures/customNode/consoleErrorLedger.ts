// Pack-attributed console noise with no visible error surface. Shared by
// the all-nodes tiers and the curated run tier so one ledger covers every
// surface a pack's script can emit on. Filter-guarded: a pattern suppresses
// matching errors for its pack only; stale entries are caught by review,
// not observation (several patterns are environment-conditional, so
// observed-firing guards would false-fail - see ARCHITECTURE.md section 10).
export const CONSOLE_ERROR_ALLOWLIST: Record<
  string,
  Array<{ pattern: RegExp; reason: string }>
> = {
  'ComfyUI-Impact-Pack': [
    {
      // Media/text widgets preview their value via root-relative URLs at
      // creation; 404s on a backend whose root does not serve the file.
      pattern:
        /Failed to load resource.*404.*(example\.png|plain_video\.mp4|file\.txt)/,
      reason: 'media widget previews its value via a root-relative URL'
    },
    {
      // PreviewBridge widgets fetch their internal preview id on configure;
      // a bare backend has no image behind it.
      pattern: /Failed to load resource.*400.*api\/impact\/get\/pb_id_image/,
      reason: 'PreviewBridge fetches its preview id on configure'
    },
    {
      // The save/reload tier writes `<value>_cn` probe values; media widgets
      // preview them as URLs and 404.
      pattern: /Failed to load resource.*404.*_cn/,
      reason: 'set-and-stick probe value previewed by a media widget'
    }
  ],
  'ComfyUI-KJNodes': [
    {
      // Image/video loader previews fetch their combo value at creation;
      // on a backend with an empty input dir the value is undefined and the
      // preview 404s (and retries with a fresh rand). Console-only noise,
      // no visible error; upstream-report candidate.
      pattern:
        /Failed to load resource.*\/api\/view\?type=input&filename=undefined/,
      reason: 'loader preview fetches undefined filename on empty input dir'
    },
    {
      // createContextMenu (editor_base.js:727) replaceChild-es a menu element
      // it assumes is attached; repeat instantiation within one page (the
      // wiring sweep creates the node once per planned pair) finds it gone
      // and throws at construction. Single creation is clean - the mount
      // tier passes. Latent pack bug, surfaced 2026-07-18 when new core
      // partner nodes (HeyGen/Gemini) grew the corpus and reshuffled the
      // sweep's pair plan. Console-only; upstream-report candidate.
      pattern:
        /Error creating SplineEditor: TypeError: Cannot read properties of null \(reading 'replaceChild'\)/,
      reason:
        'SplineEditor editor JS crashes on repeat instantiation in one page'
    }
  ],
  'ComfyUI-Custom-Scripts': [
    {
      // betterCombos.js:473 checks `typeof ret === "object" && "content" in
      // ret`; typeof null is "object", so a null ret during save/reload
      // throws `Cannot use 'in' operator to search for 'content' in null`
      // as an uncaught page error - invisible until pageerror collection
      // landed. Pack-owned and deterministic; upstream-report candidate.
      pattern: /Cannot use 'in' operator to search for 'content' in null/,
      reason: 'betterCombos.js missing null check throws during save/reload'
    }
  ]
}

export function unallowlistedErrors(pack: string, errors: string[]): string[] {
  const allowlist = CONSOLE_ERROR_ALLOWLIST[pack] ?? []
  return errors.filter(
    (error) => !allowlist.some((rule) => rule.pattern.test(error))
  )
}

// For the cross-pack wiring sweep, where an error's owning pack cannot be
// read off the collector: an error is ledgered if any pack WHOSE NODES ARE
// IN THE SWEEP owns a matching pattern. Scoped to the installed packs, so a
// pack absent from the corpus can never vouch for an error.
export function unallowlistedErrorsForPacks(
  packs: string[],
  errors: string[]
): string[] {
  return packs.reduce(
    (remaining, pack) => unallowlistedErrors(pack, remaining),
    errors
  )
}

// Execution errors surface on the tiers that actually queue prompts (the
// curated run and the auto-run tier). The mount, persistence, and wiring
// tiers queue nothing, so a prompt-execution error arriving in their console
// collector is an async stray from a prior tier's still-draining execution -
// the same "not this test" principle the event-attribution filter uses
// (ARCHITECTURE section 9). It is filtered from the non-executing tiers only;
// the executing tiers still assert on it. This is not error suppression: the
// visible error SURFACES (overlay/dialog/toast) are still asserted separately
// by expectNoVisibleErrors.
const FOREIGN_EXECUTION_NOISE: RegExp[] = [
  /PromptExecutionError/,
  /Prompt execution failed/,
  // The browser logs a rejected prompt submission as a failed resource load
  // on /api/prompt. Only the executing tiers POST there, so this line in a
  // mount/persistence/wiring collector is a prior tier's async submission.
  /Failed to load resource.*\/api\/prompt/
]
export function isForeignExecutionNoise(error: string): boolean {
  return FOREIGN_EXECUTION_NOISE.some((pattern) => pattern.test(error))
}
