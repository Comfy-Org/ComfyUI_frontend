/**
 * Every legacy construct in the corpus, and whether the published API can
 * receive it.
 *
 *   tsx scripts/magic-patch/gap_inventory.mjs --corpus <dir> [--packs N]
 *
 * The gap report mines punts, so it only learns what agents happened to hit —
 * one run, one pack, one refusal at a time, and it takes a twenty-minute run to
 * discover a gap that a grep could have found in seconds. This inventories the
 * whole corpus statically instead: every construct, how many files and packs
 * use it, and whether it has a destination.
 *
 * The output is the work list. A construct with no destination is a gap ranked
 * by what it actually blocks; a construct with one that agents still punt on is
 * a documentation failure, which has cost more files here than missing API has.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Legacy construct -> where it goes.
 *
 * `destination` names the published member; `null` means nothing receives it
 * yet. Kept beside the patterns so a capability landing updates one line.
 */
const CONSTRUCTS = [
  // ── Registration and lifecycle ─────────────────────────────────────
  ['beforeRegisterNodeDef', /\bbeforeRegisterNodeDef\b/, 'defs.extend'],
  ['onNodeCreated', /\bonNodeCreated\b/, 'b.onCreated'],
  ['onExecuted', /\bonExecuted\b/, 'b.onExecuted'],
  ['onConfigure', /\bonConfigure\b/, 'b.onConfigured'],
  ['onRemoved', /\bonRemoved\b/, 'b.onRemoved'],
  ['onSerialize', /\bonSerialize\b/, 'b.onSerialize'],
  [
    'registerCustomNodes',
    /\bregisterCustomNodes\b|\bextends\s+LGraphNode\b/,
    'defs.define'
  ],
  [
    'isVirtualNode/applyToGraph',
    /\bisVirtualNode\b|\bapplyToGraph\b/,
    'execution + resolve'
  ],

  // ── Widgets ────────────────────────────────────────────────────────
  ['ComfyWidgets factory', /\bComfyWidgets\s*[.[]/, 'widgets.add'],
  [
    'widgets array mutation',
    /\bwidgets\s*\.\s*(?:splice|push)|\bwidgets\.length\s*=/,
    'widgets.add/remove'
  ],
  ['converted-widget', /["'`]converted-widget/, 'widget.setHidden'],
  ['widget.serializeValue', /\bserializeValue\b/, 'widgets.add({serialize})'],
  ['addDOMWidget', /\baddDOMWidget\s*\(/, 'widgets.mount'],
  ['widget.callback chaining', /\bwidget\.callback\s*=/, "widget.on('change')"],

  // ── Drawing and size ───────────────────────────────────────────────
  [
    'onDrawForeground (node)',
    /\bprototype\.onDrawForeground\b|\bnode\.onDrawForeground\b/,
    'widgets.canvas'
  ],
  [
    'computeSize/onResize',
    /\bcomputeSize\b|\bonResize\b/,
    'setSizeConstraints'
  ],

  // ── Connections ────────────────────────────────────────────────────
  ['onConnectionsChange', /\bonConnectionsChange\b/, 'b.onConnectionsChanged'],
  [
    'onConnectInput/Output (veto)',
    /\bonConnectInput\b|\bonConnectOutput\b/,
    'b.onBeforeConnect'
  ],
  [
    'dynamic slots',
    /\baddInput\s*\(|\bremoveInput\s*\(|\baddOutput\s*\(|\bremoveOutput\s*\(/,
    'inputs.add/remove'
  ],
  [
    'link internals',
    /\borigin_id\b|\btarget_id\b|\binputs\[[^\]]*\]\.link\b/,
    'slots + LinkInfo'
  ],

  // ── Canvas-level, not node-level ───────────────────────────────────
  [
    'LGraphCanvas internals',
    /\bLGraphCanvas\.prototype\b|\bcanvas\.draw\s*=|\bonDrawBackground\b/,
    null
  ],
  [
    'canvas selection',
    /\bselected_nodes\b|\bselectedItems\b/,
    'graph.selection'
  ],
  // Polling a draw callback for structural change. Nothing receives it: there
  // is no graph-level change event, only per-widget and per-connection ones.
  [
    'graph structure polling',
    /\b_groups\b|\bgraph\.(?:_nodes|_version)\b/,
    null
  ],
  [
    'ContextMenu / slot menu',
    /\bContextMenu\b|\bgetExtraMenuOptions\b|\bshowConnectionMenu\b/,
    'b.addMenuItem'
  ],
  [
    'pointer gestures on canvas',
    /\bonMouseDown\b|\bonMouseMove\b|\bonMouseUp\b/,
    null
  ],

  // ── App and wire format ────────────────────────────────────────────
  ['graphToPrompt', /\bgraphToPrompt\b/, null],
  ['queuePrompt', /\bqueuePrompt\b/, null],
  [
    'api.addEventListener',
    /\bapi\.addEventListener\s*\(/,
    'b.onPreview (previews only)'
  ],
  ['api.fetchApi', /\bapi\.fetchApi\s*\(/, null],
  ['app.extensionManager', /\bextensionManager\b/, null],
  ['settings get/set', /\bsetting\s*\.\s*(?:get|set)\b|\baddSetting\b/, null],
  ['node type replacement', /\brecreateNode\b|\breplaceNode\b/, null]
]

function jsFiles(dir, depth = 0) {
  if (depth > 8) return []
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    if (name === 'node_modules') return []
    const path = join(dir, name)
    try {
      return statSync(path).isDirectory()
        ? jsFiles(path, depth + 1)
        : name.endsWith('.js')
          ? [path]
          : []
    } catch {
      return []
    }
  })
}

/** Strips comments and strings, so documentation of an API is not usage. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

export function inventory(corpus, packLimit = Infinity) {
  const stats = new Map(
    CONSTRUCTS.map(([name, , destination]) => [
      name,
      { destination, files: 0, packs: new Set() }
    ])
  )

  const packs = readdirSync(corpus).slice(0, packLimit)
  let scanned = 0
  for (const pack of packs) {
    for (const path of jsFiles(join(corpus, pack))) {
      let source
      try {
        source = code(readFileSync(path, 'utf8'))
      } catch {
        continue
      }
      scanned++
      for (const [name, pattern] of CONSTRUCTS) {
        if (!pattern.test(source)) continue
        const entry = stats.get(name)
        entry.files++
        entry.packs.add(pack)
      }
    }
  }
  return { stats, packs: packs.length, files: scanned }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  const corpus = argv[argv.indexOf('--corpus') + 1]
  const limitIndex = argv.indexOf('--packs')
  const limit = limitIndex === -1 ? Infinity : Number(argv[limitIndex + 1])
  if (!corpus || argv.indexOf('--corpus') === -1) {
    console.error('usage: gap_inventory.mjs --corpus <dir> [--packs N]')
    process.exit(2)
  }

  const { stats, packs, files } = inventory(corpus, limit)
  const rows = [...stats].sort((a, b) => b[1].packs.size - a[1].packs.size)

  const show = (title, filter) => {
    const chosen = rows.filter(([, s]) => filter(s) && s.packs.size)
    if (!chosen.length) return
    console.error(`\n${title}\n`)
    console.error('construct                        packs  files  destination')
    for (const [name, s] of chosen) {
      console.error(
        `${name.padEnd(32)} ${String(s.packs.size).padStart(5)}  ${String(s.files).padStart(5)}  ${s.destination ?? '— NONE —'}`
      )
    }
  }

  console.error(`Scanned ${files} JS file(s) across ${packs} pack(s).`)
  show('NO DESTINATION — these are the real gaps', (s) => !s.destination)
  show('Has a destination', (s) => s.destination)
}
