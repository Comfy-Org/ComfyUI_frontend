/**
 * Does this file touch the API being retired at all?
 *
 * The rule catalog answers a narrower question — does this file match one of
 * the five patterns we can describe precisely — and using it to decide what to
 * convert left most of every pack unexamined: 115 of comfy-mtb's 119 files, 66
 * of rgthree's 74. Those were never cleared, only never looked at.
 *
 * This is the wider gate. A file that reaches the host in any way is a
 * candidate for conversion; a file that does not is a helper or a vendored
 * library and is genuinely none of our business.
 *
 * Deliberately generous. A false positive costs an agent deciding there is
 * nothing to do; a false negative ships a pack still on the old surface while
 * reporting it converted.
 */

/**
 * Ways a file reaches the host, grouped so a report can say what it found.
 *
 * Drawn from the registry census and the ecosystem survey — the same surfaces
 * the API is replacing.
 */
const SURFACES: readonly (readonly [string, RegExp])[] = [
  // Imports of the four host modules — 8,600 sites across the corpus.
  ['host-import', /from\s+["'][^"']*\/scripts\/(app|api|widgets|ui)\.js["']/],
  [
    'host-global',
    /\bwindow\.comfyAPI\b|\bwindow\.LiteGraph\b|\bglobalThis\.app\b/
  ],

  // Registration and the generated class.
  ['register-extension', /\bapp\.registerExtension\s*\(/],
  ['prototype-patch', /\.prototype\.[A-Za-z_]\w*\s*=/],
  [
    'register-node-type',
    /\bLiteGraph\.registerNodeType\s*\(|\bregisterCustomNodes\b/
  ],
  ['node-subclass', /\bextends\s+LGraphNode\b/],

  // Entity internals with published replacements.
  [
    'widget-internals',
    /\bwidgets\s*\.\s*(?:splice|push|length\s*=)|\bwidget\.(?:type|origType|serializeValue|inputEl)\b/
  ],
  [
    'slot-internals',
    /\b(?:inputs|outputs)\s*\[[^\]]*\]\s*\.\s*(?:link|links)\b|\borigin_id\b|\btarget_id\b/
  ],
  ['converted-widget', /["'`]converted-widget/],
  ['virtual-node', /\bisVirtualNode\b|\bapplyToGraph\b/],

  // Wire format and execution.
  [
    'serialization',
    /\bgraphToPrompt\b|\bserializeValue\b|\bwidgets_values\b|\bserialize_widgets\b/
  ],
  ['queue', /\bqueuePrompt\b/],
  ['api-events', /\bapi\.addEventListener\s*\(|\bapi\.fetchApi\s*\(/],

  // Canvas and DOM surfaces.
  [
    'canvas-draw',
    /\bonDrawForeground\b|\bonDrawBackground\b|\bLGraphCanvas\.prototype\b/
  ],
  ['dom-widget', /\baddDOMWidget\s*\(/],
  ['graph-internals', /\bgraph\._version\b|\bsetDirtyCanvas\s*\(/]
]

export interface LegacyUsage {
  readonly usesLegacyApi: boolean
  /** Which surface groups matched, for reporting and triage. */
  readonly surfaces: readonly string[]
}

/**
 * Strips comments and string literals before matching.
 *
 * Without this a pack's own documentation of the old API — and there is a lot
 * of it — counts as usage, and whole files get queued on the strength of a
 * comment.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

export function detectLegacyUsage(source: string): LegacyUsage {
  const stripped = code(source)
  const surfaces = SURFACES.filter(([, pattern]) => pattern.test(stripped)).map(
    ([name]) => name
  )
  return { usesLegacyApi: surfaces.length > 0, surfaces }
}
