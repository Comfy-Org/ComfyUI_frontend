interface AllowlistRule {
  pattern: RegExp
  reason: string
  requiredRoundtripId?: string
}

interface ConnectivityRule extends AllowlistRule {
  requiredConnectivityId?: string
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

// The breadth sweep intentionally creates and configures thousands of pack
// nodes in one page. These exact pack-owned mechanisms are allowed only in
// that tier. Deterministic mechanisms opt into required observation so a
// fixed or renamed mechanism immediately makes the ledger stale instead of
// staying hidden; environment-state mechanisms remain exact but conditional.
const CONNECTIVITY_ERROR_ALLOWLIST: Record<string, ConnectivityRule[]> = {
  'ComfyUI-KJNodes': [
    {
      pattern:
        /Error parsing stored points: SyntaxError: Unexpected end of JSON input[\s\S]*\/extensions\/ComfyUI-KJNodes\/js\/editors\/point_editor_canvas\.js/,
      reason:
        'PointsEditor parses an empty bbox widget when the sweep configures the node',
      requiredConnectivityId: 'kj-points-empty-bbox-json'
    }
  ],
  'ComfyUI-Custom-Scripts': [
    {
      pattern:
        /Failed to load resource.*status of 404\b.*http:\/\/localhost:8188\/api\/pysssss\/examples\/loras%2FNone(?:[\s\]]|$)/,
      reason:
        'betterCombos conditionally requests examples for its literal None default and the pack route returns 404 when no matching lora exists'
    },
    // mathExpression.js:31 draws `app.nodeOutputs[this.id].value[0]` inside
    // onDrawForeground; the sweep repeatedly clears the graph and node ids
    // recycle, so a stale nodeOutputs entry from an earlier sweep prompt can
    // sit under a reused id WITHOUT a `value` field. Frame-timing dependent
    // (only fires when a MathExpression node draws while such an entry
    // exists), so no requiredConnectivityId - it must not become a
    // must-fire staleness obligation. Pack-owned; upstream-report candidate.
    {
      pattern:
        /Cannot read properties of undefined \(reading '0'\)[\s\S]*\/extensions\/ComfyUI-Custom-Scripts\/js\/mathExpression\.js/,
      reason:
        'MathExpression onDrawForeground indexes a stale value-less nodeOutputs entry under a reused node id while the sweep clears graphs'
    }
  ],
  'ComfyUI-VideoHelperSuite': [
    {
      pattern:
        /Cannot read properties of undefined \(reading 'target_id'\)[\s\S]*\/extensions\/ComfyUI-VideoHelperSuite\/js\/VHS\.core\.js/,
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
export function allowlistRulesFor(pack: string): AllowlistRule[] {
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

export function staleRequiredRoundtripErrorRules(
  pack: string,
  errors: string[]
): string[] {
  return allowlistRulesFor(pack)
    .filter(
      (rule) =>
        rule.requiredRoundtripId !== undefined &&
        !errors.some((error) => ruleMatches(rule, error))
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
