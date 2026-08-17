interface AllowlistRule {
  global?: boolean
  pattern: RegExp
  reason: string
  requiredStartupId?: string
  restore?: string
}

interface ConnectivityRule extends AllowlistRule {
  requiredConnectivityId?: string
}

// Pack-attributed console noise with no visible error surface. Shared by
// the all-nodes tiers and the curated run tier so one ledger covers every
// surface a pack's script can emit on. Filter-guarded: a pattern suppresses
// matching errors for its pack only. Most entries are environment-conditional
// and remain review-stale.
const CONSOLE_ERROR_ALLOWLIST: Record<string, AllowlistRule[]> = {
  'comfyui-itools': [
    {
      pattern:
        /Error: File not found.*\/extensions\/comfyui-itools\/makadi\/SmartPaintArea\.js/,
      global: true,
      reason:
        'the paint widget logs the API no-saved-drawing response from SmartPaintArea.js'
    },
    {
      pattern:
        /Failed to load resource.*404.*api\/itools\/request_the_paint_file/,
      global: true,
      reason:
        'the paint widget requests its backing file on creation and the route 404s until one is saved'
    },
    {
      pattern:
        /Error calling extension 'iTools\.cropImage' method 'nodeCreated'.*Cannot read properties of undefined \(reading 'draw'\)/,
      global: true,
      reason:
        'cropImage assumes its custom preview widget exists when its async nodeCreated hook resumes'
    }
  ],
  'ComfyUI-Impact-Pack': [
    {
      pattern:
        /\[vite:preloadError\].*\/extensions\/ComfyUI-Impact-Pack\/impact-sam-editor\.js.*Failed to fetch dynamically imported module/,
      global: true,
      requiredStartupId: 'impact-sam-editor-legacy-clipspace-import',
      reason:
        'impact-sam-editor.js imports the removed extensions/core/clipspace.js module',
      restore:
        'replace the legacy ClipspaceDialog import and remove this entry when impact-sam-editor.js imports successfully'
    },
    {
      // Media/text widgets preview their value via root-relative URLs at
      // creation; 404s on a backend whose root does not serve the file.
      pattern:
        /Failed to load resource.*404.*(beach\.jpg|example\.png|plain_video\.mp4|file\.txt)/,
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
  ],
  'ComfyUI-UltraShape1': [
    {
      pattern:
        /Failed to load resource.*404.*api\/view\?type=input&filename=%28upload\+a\+mesh\+file%29&subfolder=&rand=/,
      global: true,
      reason:
        'mesh preview requests the literal upload-placeholder value on a backend with no mesh input'
    }
  ],
  'WhatDreamsCost-ComfyUI': [
    {
      pattern:
        /\[vite:preloadError\].*Unexpected token '\}'\} \[http:\/\/localhost:8188\/assets\//,
      global: true,
      requiredStartupId: 'ltx-director-guide-syntax',
      reason:
        'js/ltx_director_guide.js at the pinned commit has an extra closing brace and cannot parse',
      restore:
        'fix js/ltx_director_guide.js and remove this entry when startup imports it without a preload error'
    },
    {
      pattern:
        /Failed to load resource.*404.*api\/view\?filename=_cn&type=input/,
      reason: 'set-and-stick probe value previewed by the media loader'
    }
  ],
  'ComfyUI_Fill-Nodes': [
    {
      pattern:
        /Failed to load resource.*404.*https:\/\/api\.comfy\.org\/comfy-nodes\/\/node/,
      reason: 'pack metadata lookup requests an empty node name on creation'
    }
  ],
  ComfyUI_LayerStyle_Advance: [
    {
      pattern:
        /\[vite:preloadError\].*Extension named 'ColorOverlay' already registered\./,
      global: true,
      requiredStartupId: 'duplicate-color-overlay',
      reason:
        'this pack and comfyui_layerstyle both register the ColorOverlay extension in their pinned dz_node_palette.js',
      restore:
        'give the extensions distinct names and remove this entry when both packs load without a duplicate-registration error'
    }
  ],
  'comfyui-sam3': [
    {
      pattern:
        /\[vite:preloadError\].*\/extensions\/comfyui-sam3\/sam3-editor\.js.*Failed to fetch dynamically imported module/,
      global: true,
      requiredStartupId: 'sam3-editor-legacy-clipspace-import',
      reason:
        'sam3-editor.js imports the removed extensions/core/clipspace.js module',
      restore:
        'replace the legacy ClipspaceDialog import and remove this entry when sam3-editor.js imports successfully'
    }
  ]
}

// The breadth sweep intentionally creates and configures thousands of pack
// nodes in one page. These exact pack-owned mechanisms are allowed only in
// that tier. Deterministic mechanisms opt into required observation so a
// fixed or renamed mechanism immediately makes the ledger stale instead of
// staying hidden; environment-state mechanisms remain exact but conditional.
const CONNECTIVITY_ERROR_ALLOWLIST: Record<string, ConnectivityRule[]> = {
  'comfyui-itools': [
    {
      pattern:
        /Failed to load resource.*404.*api\/itools\/request_the_paint_file/,
      reason:
        'the paint widget requests its backing file on creation and the route 404s until one is saved'
    },
    {
      pattern:
        /Error calling extension 'iTools\.cropImage' method 'nodeCreated'.*Cannot read properties of undefined \(reading 'draw'\)/,
      reason:
        'cropImage assumes its custom preview widget exists when its async nodeCreated hook resumes'
    }
  ],
  'ComfyUI-KJNodes': [
    {
      pattern:
        /Error parsing stored points: SyntaxError: Unexpected end of JSON input[\s\S]*\/extensions\/ComfyUI-KJNodes\/js\/editors\/point_editor_canvas\.js/,
      reason:
        'PointsEditor parses an empty bbox widget when the sweep configures the node',
      requiredConnectivityId: 'kj-points-empty-bbox-json'
    }
  ],
  'ComfyUI-LTXVideo': [
    {
      pattern:
        /Cannot read properties of null \(reading 'imgH'\)[\s\S]*\/extensions\/ComfyUI-LTXVideo\/js\/sparse_track_editor\.js/,
      reason:
        'the sparse track editor computes its size before image state initializes',
      requiredConnectivityId: 'ltx-sparse-track-null-image-size'
    }
  ],
  'ComfyUI-Custom-Scripts': [
    {
      pattern:
        /Failed to load resource.*status of 404\b.*http:\/\/localhost:8188\/api\/pysssss\/examples\/loras%2FNone(?:[\s\]]|$)/,
      reason:
        'betterCombos conditionally requests examples for its literal None default and the pack route returns 404 when no matching lora exists'
    }
  ],
  'ComfyUI-VideoHelperSuite': [
    {
      pattern:
        /Cannot read properties of undefined \(reading 'target_id'\)[\s\S]*\/extensions\/comfyui-videohelpersuite\/js\/VHS\.core\.js/i,
      reason:
        'VHS file refresh reads a removed link while the sweep repeatedly clears the graph',
      requiredConnectivityId: 'core-vhs-removed-link-target-id'
    }
  ]
}

function foldedRulesFor<T extends AllowlistRule>(
  ledger: Record<string, T[]>,
  pack: string
): T[] {
  const folded = pack.toLowerCase()
  return Object.entries(ledger)
    .filter(([ledgered]) => ledgered.toLowerCase() === folded)
    .flatMap(([, rules]) => rules)
}

// Some backends install packs under a lower-cased dirname
// (comfyui-impact-pack for ComfyUI-Impact-Pack), so an exact-key lookup
// ledgers nothing there and the pack's known noise reds the run. Fold the
// key so one entry covers both targets; fold-equal keys merge rather than
// shadow each other.
function allowlistRulesFor(pack: string): AllowlistRule[] {
  return foldedRulesFor(CONSOLE_ERROR_ALLOWLIST, pack)
}

function connectivityRulesForPacks(packs: string[]): ConnectivityRule[] {
  return packs.flatMap((pack) =>
    foldedRulesFor(CONNECTIVITY_ERROR_ALLOWLIST, pack)
  )
}

function withoutMatches(rules: AllowlistRule[], errors: string[]): string[] {
  return errors.filter(
    (error) => !rules.some((rule) => ruleMatches(rule, error))
  )
}

function ruleMatches(rule: AllowlistRule, error: string): boolean {
  return rule.pattern.test(error)
}

export function unallowlistedErrors(pack: string, errors: string[]): string[] {
  return withoutMatches(allowlistRulesFor(pack), errors)
}

export function unallowlistedGlobalExtensionErrorsForPacks(
  packs: string[],
  errors: string[]
): string[] {
  const rules = packs.flatMap((pack) =>
    allowlistRulesFor(pack).filter((rule) => rule.global)
  )
  return withoutMatches(rules, errors)
}

export function customExtensionStartupErrors(
  errors: readonly string[]
): string[] {
  return errors.filter(
    (error) =>
      /\/extensions\/(?!core\/)/i.test(error) ||
      /(?:error (?:loading|calling)|failed to load) extension\b/i.test(error) ||
      /\[vite:preloadError\]/.test(error)
  )
}

export function staleRequiredStartupErrorRulesForPacks(
  packs: string[],
  errors: string[]
): string[] {
  return packs.flatMap((pack) =>
    allowlistRulesFor(pack)
      .filter(
        (rule) =>
          rule.requiredStartupId !== undefined &&
          !errors.some((error) => ruleMatches(rule, error))
      )
      .map((rule) => `${pack}/${rule.requiredStartupId}`)
  )
}

export function startupErrorExclusionsForPacks(packs: string[]) {
  return packs.flatMap((pack) =>
    allowlistRulesFor(pack).flatMap((rule) =>
      rule.requiredStartupId && rule.restore
        ? [
            {
              label: `${pack} startup extension ${rule.requiredStartupId}`,
              pack,
              reason: rule.reason,
              restore: rule.restore
            }
          ]
        : []
    )
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

export function unallowlistedConnectivityErrorsForPacks(
  packs: string[],
  errors: string[]
): string[] {
  return withoutMatches(
    connectivityRulesForPacks(packs),
    unallowlistedErrorsForPacks(packs, errors)
  )
}

export function staleRequiredConnectivityErrorRulesForPacks(
  packs: string[],
  errors: string[]
): string[] {
  return connectivityRulesForPacks(packs)
    .filter(
      (rule) =>
        rule.requiredConnectivityId !== undefined &&
        !errors.some((error) => ruleMatches(rule, error))
    )
    .map((rule) => rule.requiredConnectivityId!)
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
