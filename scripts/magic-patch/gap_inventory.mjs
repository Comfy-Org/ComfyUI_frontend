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
 *
 * `REFUSED(reason)` is a third state, and the distinction earns its keep: a
 * refusal is a decision that has already been taken, so it is not work. Ranking
 * refusals beside unbuilt capabilities put patching the canvas renderer at the
 * top of the list on 23 packs, where it read as the most urgent thing to build.
 */
const REFUSED = (reason) => `REFUSED — ${reason}`
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
    REFUSED('the renderer is ours to replace')
  ],
  [
    'canvas selection',
    /\bselected_nodes\b|\bselectedItems\b/,
    'graph.selection'
  ],
  // These three were one row reading "graph structure polling — NONE", which
  // put them at the top of the work list on 24 packs. They are not one thing.
  // Enumerating the graph is 78 of those 74-odd files and has been served since
  // the first release; only the version poll has nothing to receive it, and
  // that is four files. Ranking by a label rather than by a construct sent the
  // programme after a capability almost nobody was asking for.
  ['graph node enumeration', /\bgraph\.(?:_nodes)\b/, 'graph.nodes()'],
  ['group enumeration', /\b_groups\b/, 'graph.groups()'],
  ['graph version polling', /\bgraph\._version\b/, null],
  [
    'ContextMenu / slot menu',
    /\bContextMenu\b|\bgetExtraMenuOptions\b|\bshowConnectionMenu\b/,
    'b.addMenuItem'
  ],
  [
    'pointer gestures on canvas',
    /\bonMouseDown\b|\bonMouseMove\b|\bonMouseUp\b/,
    'widgets.canvas onDown/onMove/onUp'
  ],

  // ── App and wire format ────────────────────────────────────────────
  [
    'graphToPrompt',
    /\bgraphToPrompt\b/,
    REFUSED('reading or editing the built prompt')
  ],
  ['queuePrompt', /\bqueuePrompt\b/, 'comfy.queue'],
  [
    'api.addEventListener',
    /\bapi\.addEventListener\s*\(/,
    'b.onPreview (previews only)'
  ],
  ['api.fetchApi', /\bapi\.fetchApi\s*\(/, 'comfy.backend'],
  ['app.extensionManager', /\bextensionManager\b/, 'comfy.commands + comfy.ui'],
  [
    'settings get/set',
    /\bsetting\s*\.\s*(?:get|set)\b|\baddSetting\b/,
    'comfy.settings'
  ],
  ['node type replacement', /\brecreateNode\b|\breplaceNode\b/, 'graph.replace']
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
  const refused = (s) => s.destination?.startsWith('REFUSED')
  show('NO DESTINATION — these are the real gaps', (s) => !s.destination)
  show('Refused by design — not work', refused)
  show('Has a destination', (s) => s.destination && !refused(s))
}
