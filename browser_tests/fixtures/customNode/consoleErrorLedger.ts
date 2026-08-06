import { customNodesEnv } from '@e2e/fixtures/customNode/manifest'

interface AllowlistRule {
  pattern: RegExp
  reason: string
  requiredRoundtripId?: string
}

// Pack-attributed console noise with no visible error surface. Shared by
// the all-nodes tiers and the curated run tier so one ledger covers every
// surface a pack's script can emit on. Filter-guarded: a pattern suppresses
// matching errors for its pack only. Most entries are environment-conditional
// and remain review-stale; deterministic roundtrip rules opt into observation
// with requiredRoundtripId.
const CONSOLE_ERROR_ALLOWLIST: Record<string, AllowlistRule[]> = {
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
      // The SHARED editor base (editor_base.js:727 createContextMenu)
      // replaceChild-es a menu element it assumes is attached; repeat
      // instantiation within one page (the wiring sweep creates a node once
      // per planned pair) finds it gone and throws at construction - for
      // EVERY editor subclass (SplineEditor and PointsEditor observed), so
      // the pattern matches the mechanism, not one class name. Single
      // creation is clean - the mount tier passes. Latent pack bug,
      // surfaced 2026-07-18 when new core partner nodes (HeyGen/Gemini)
      // grew the corpus and reshuffled the sweep's pair plan. Console-only;
      // upstream-report candidate.
      pattern:
        /Error creating \w+Editor: TypeError: Cannot read properties of null \(reading 'replaceChild'\)/,
      reason:
        'KJNodes editor_base createContextMenu crashes on repeat instantiation (all editor subclasses)'
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

const CLOUD_PACK_ERROR_ALLOWLIST: Record<string, AllowlistRule[]> = {
  'comfyui-videohelpersuite': [
    {
      pattern:
        /Failed to load resource.*404.*\/api\/vhs\/getpath\?path=output%2F(?:[\s\]]|$)/,
      reason:
        'VHS SelectLatest requests the Cloud output directory through an unavailable getpath endpoint',
      requiredRoundtripId: 'cloud-vhs-getpath-output-directory'
    },
    {
      pattern:
        /options\.filter is not a function[\s\S]*\/extensions\/comfyui-videohelpersuite\/js\/VHS\.core\.js/,
      reason:
        'VHS 1.7.9 treats the Cloud getpath error body as an array without checking the response',
      requiredRoundtripId: 'cloud-vhs-getpath-non-array-response'
    }
  ]
}

// Noise owned by the target deployment rather than by any pack, so it applies
// to every pack's collector on that environment.
const ENV_ERROR_ALLOWLIST: Record<string, AllowlistRule[]> = {
  cloud: [
    {
      // Cloud's /object_info advertises input-dir media (beach.jpg,
      // bedroom.mp4, eth3d.png) that /api/view then refuses to serve the
      // smoke account, so every media widget previewing its combo default
      // 404s - across packs, which is why it is env-scoped and not pack
      // -attributed. Backend-side finding, tracked for escalation; console
      // -only, no visible error surface.
      pattern: /Failed to load resource.*404.*\/api\/view\?.*type=input/,
      reason:
        'cloud advertises input files /api/view will not serve the smoke account'
    },
    {
      // VHS creates an audio preview from its empty/default selection. The
      // endpoint rejects the zero-length preview request on Cloud.
      pattern:
        /Failed to load resource.*400.*\/api\/vhs\/viewaudio\?(?!(?:[^&\s\]]*&)*filename=[^&\s\]]+(?:&|[\s\]]|$))(?=(?:[^&\s\]]*&)*start_time=0(?:&|[\s\]]|$))(?=(?:[^&\s\]]*&)*duration=0(?:&|[\s\]]|$))/,
      reason: 'VHS empty/default audio preview is rejected by Cloud'
    },
    {
      // VHS creates video previews from the default input-dir combo value,
      // which Cloud advertises but does not serve to the smoke account.
      pattern:
        /Failed to load resource.*404.*\/api\/vhs\/viewvideo\?(?=(?:[^&\s\]]*&)*filename=[^&\s\]]+(?:&|[\s\]]|$))(?=(?:[^&\s\]]*&)*type=input(?:&|[\s\]]|$))/,
      reason:
        'VHS previews a Cloud-advertised default video the smoke account cannot retrieve'
    },
    {
      // Cloudflare fronts the cloud origin and injects its bot-challenge
      // script tag; the vite preview origin the suite loads does not serve
      // /cdn-cgi, so the tag 404s. Environment, not the app.
      pattern: /Failed to load resource.*404.*\/cdn-cgi\/challenge-platform\//,
      reason: 'Cloudflare bot-challenge script is not served by this origin'
    }
  ]
}

// Cloud installs some packs under a lower-cased dirname
// (comfyui-impact-pack for ComfyUI-Impact-Pack), so an exact-key lookup
// ledgers nothing there and the pack's known noise reds the run. Fold the
// key so one entry covers both targets; fold-equal keys merge rather than
// shadow each other.
export function allowlistRulesFor(pack: string): AllowlistRule[] {
  const folded = pack.toLowerCase()
  return [
    ...Object.entries(CONSOLE_ERROR_ALLOWLIST)
      .filter(([ledgered]) => ledgered.toLowerCase() === folded)
      .flatMap(([, rules]) => rules),
    ...(customNodesEnv() === 'cloud'
      ? Object.entries(CLOUD_PACK_ERROR_ALLOWLIST)
          .filter(([ledgered]) => ledgered.toLowerCase() === folded)
          .flatMap(([, rules]) => rules)
      : []),
    ...(ENV_ERROR_ALLOWLIST[customNodesEnv()] ?? [])
  ]
}

function withoutMatches(rules: AllowlistRule[], errors: string[]): string[] {
  return errors.filter(
    (error) => !rules.some((rule) => rule.pattern.test(error))
  )
}

export function unallowlistedErrors(pack: string, errors: string[]): string[] {
  return withoutMatches(allowlistRulesFor(pack), errors)
}

export function staleRequiredRoundtripErrorRules(
  pack: string,
  errors: string[]
): string[] {
  return allowlistRulesFor(pack)
    .filter(
      (rule) =>
        rule.requiredRoundtripId !== undefined &&
        !errors.some((error) => rule.pattern.test(error))
    )
    .map((rule) => rule.requiredRoundtripId!)
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
    withoutMatches(ENV_ERROR_ALLOWLIST[customNodesEnv()] ?? [], errors)
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
