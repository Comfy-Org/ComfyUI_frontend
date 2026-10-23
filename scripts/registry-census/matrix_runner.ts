/**
 * Matrix runner — executed once per pack in an isolated vitest file.
 * Loads the pack's real JS, then runs the user-operation battery and drives
 * the pack's own frontend-registered node types. Writes one JSON row to
 * $MATRIX_OUT/<pack>.json for cross-branch diffing.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import fs from 'node:fs'
import { vi } from 'vitest'

import defaultWorkflow from '../../browser_tests/assets/default.json'
import type {
  ISerialisedNode,
  LGraph,
  LGraphCanvas,
  LGraphNode,
  Point
} from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import type { useWidgetValueStore } from '@/stores/widgetValueStore'

const S = (v: unknown) => JSON.stringify(v)
const errMsg = (e: unknown) =>
  (e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    .replace(/\s+/g, ' ')
    .slice(0, 120)
const argText = (a: unknown): string => {
  if (a instanceof Error) return `${a.name}: ${a.message}`
  if (a && typeof a === 'object') {
    const e = (a as { error?: unknown }).error
    if (e instanceof Error) return `${e.name}: ${e.message}`
    try {
      return S(a)
    } catch {
      return '[unserializable]'
    }
  }
  return String(a)
}

let DEPR: string[] = []
let NOTE = ''
let DISPATCHED = true

/** Store rows could not be read at all, as distinct from "read, and clean". */
const UNMEASURED = 'unmeasured'

type WidgetValueStore = ReturnType<typeof useWidgetValueStore>

/** The pre-Vue "convert widget to input" convention, still shipped by packs. */
type ConvertibleWidget = IBaseWidget & {
  origType?: string
  origComputeSize?: IBaseWidget['computeSize']
}

interface SigNode {
  id: unknown
  type: unknown
  widgets: unknown
  r: unknown
  st: unknown
  wn: unknown
}

interface OpRecord {
  err: string
  sig: string
  depr: string
  desync: string
  dispatching: boolean
  note: string
}

const COMBO = (o: string[]): InputSpec => [o, {}]
const DEFS: Record<string, Partial<ComfyNodeDef>> = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: COMBO(['v1-5-pruned.ckpt']) } },
    output: ['MODEL', 'CLIP', 'VAE'],
    output_name: ['MODEL', 'CLIP', 'VAE']
  },
  CLIPTextEncode: {
    input: {
      required: { text: ['STRING', { multiline: true }], clip: ['CLIP', {}] }
    },
    output: ['CONDITIONING'],
    output_name: ['CONDITIONING']
  },
  EmptyLatentImage: {
    input: {
      required: {
        width: ['INT', { default: 512 }],
        height: ['INT', { default: 512 }],
        batch_size: ['INT', { default: 1 }]
      }
    },
    output: ['LATENT'],
    output_name: ['LATENT']
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL', {}],
        seed: ['INT', { default: 0 }],
        steps: ['INT', { default: 20 }],
        cfg: ['FLOAT', { default: 8 }],
        sampler_name: COMBO(['euler', 'dpmpp_2m']),
        scheduler: COMBO(['normal', 'karras']),
        positive: ['CONDITIONING', {}],
        negative: ['CONDITIONING', {}],
        latent_image: ['LATENT', {}],
        denoise: ['FLOAT', { default: 1 }]
      }
    },
    output: ['LATENT'],
    output_name: ['LATENT']
  },
  VAEDecode: {
    input: { required: { samples: ['LATENT', {}], vae: ['VAE', {}] } },
    output: ['IMAGE'],
    output_name: ['IMAGE']
  },
  SaveImage: {
    input: {
      required: {
        images: ['IMAGE', {}],
        filename_prefix: ['STRING', { default: 'ComfyUI' }]
      }
    },
    output: [],
    output_name: []
  }
}

async function installGlobals() {
  const lg = await import('@/lib/litegraph/src/litegraph')
  const appMod = await import('@/scripts/app')
  const uiMod = await import('@/scripts/ui')
  const apiMod = await import('@/scripts/api')
  const widgetsMod = await import('@/scripts/widgets')
  const utilsMod = await import('@/scripts/utils')
  const domWidgetMod = await import('@/scripts/domWidget')
  lg.LiteGraph.alwaysRepeatWarnings = true
  lg.LiteGraph.vueNodesMode = process.env.MATRIX_VUE === '1'
  lg.LiteGraph.onDeprecationWarning = [
    (m: string) => {
      const st = new Error().stack ?? ''
      const frame = st
        .split('\n')
        .find((l) => l.includes('__ecs_matrix__/packs'))
      DEPR.push(m.slice(0, 30) + (frame ? ' @pack' : ' @core'))
    }
  ]
  const globals = {
    comfyAPI: {
      app: appMod,
      api: apiMod,
      ui: uiMod,
      widgets: widgetsMod,
      utils: utilsMod,
      domWidget: domWidgetMod
    },
    app: appMod.app,
    api: apiMod.api,
    LiteGraph: lg.LiteGraph,
    LGraphNode: lg.LGraphNode,
    LGraph: lg.LGraph,
    LGraphCanvas: lg.LGraphCanvas,
    LLink: lg.LLink
  }
  Object.assign(globalThis, globals)
  if (typeof window !== 'undefined') Object.assign(window, globals)
  return { lg, app: appMod.app }
}

/**
 * The input types whose widget layout is a function of a widget VALUE, so the
 * order a serialise observed does not predict the order a reload produces.
 * Mirrors `VALUE_DEPENDENT_LAYOUT_INPUT_TYPES` in
 * `src/workbench/extensions/agent/crdt/docOpMinter.ts`.
 */
const VALUE_DEPENDENT_LAYOUT_INPUT_TYPES = new Set([
  'COMFY_AUTOGROW_V3',
  'COMFY_DYNAMICCOMBO_V3',
  'COMFY_DYNAMICGROUP_V3'
])

/** Mirrors `isValueWidget` in docOpMinter.ts, live-widget arm only. */
const isValueWidget = (w: IBaseWidget | undefined) =>
  !!w && w.type !== 'button' && w.serialize !== false

interface FormRow {
  /** Node class, so a verdict can be attributed to a node type. */
  t: string
  /** The verdict reached; the full vocabulary is `KNOWN` in the reporter. */
  v: string
  /** Derived `order` length. */
  o: number
  /** Value-widget keys in the post-hook named projection. */
  k: number
  /** Live `node.widgets` length. */
  w: number
  /** Serialised positional length, or `dict` / `absent`. */
  a: number | string
  /**
   * `battery` for a default-workflow node the pack's hooks acted on, `driven`
   * for one of the pack's OWN registered node types. The distinction matters:
   * a custom serializer lives on a pack's own class, and the battery's nodes
   * only ever see that pack through its extension hooks.
   */
  src: string
}

/** The node-def input specs the form producer consults, per node. */
type DefInputs = (node: LGraphNode) => Record<string, { type?: unknown }> | null

// ---- form/values agreement --------------------------------------------
/**
 * Form/values agreement over the post-hook serialisation. The helpers down to
 * `measureFormAgreement` are this one measurement.
 *
 * The producer this measures is `docOpMinter.nodeLocalWidgetForm`: it derives
 * `widgets_values_form.order` from the live `node.widgets` and emits it only
 * when the derivation is *closed* over the serialised named projection,
 * declining otherwise. A node that carries a form consults no catalogue on any
 * leg, so a wrong form is authoritative and strictly worse than no form —
 * which makes a decline a correct outcome and only a *disagreeing* form a
 * defect. This records which outcome each node reaches; it is deliberately not
 * a pass/fail bit, and `summarize_matrix.py` never gates on it.
 *
 * Measured against serialisations the battery already produced — the graph's
 * at the `serialize` op and each driven node's own, in the loop that already
 * calls `node.serialize()`. No extra `onSerialize` dispatch is introduced: a
 * second dispatch would change what every other channel in this row observes.
 *
 * Reimplemented here rather than imported: pulling the agent extension's
 * dependency graph into every per-pack spec would change what is loaded in
 * every row. `test_summarize_form_agreement.py` pins the verdict vocabulary in
 * both directions, so a verdict added here without a home in the reporter, or
 * left in the reporter after being removed here, fails that test.
 */

/** Serialised positional length, or why there is no length to report. */
function positionalShape(positional: unknown): number | string {
  if (Array.isArray(positional)) return positional.length
  return positional == null ? 'absent' : 'dict'
}

/**
 * Element-wise, not a joined comparison: widget names legitimately contain
 * spaces (`choose video to upload`), so any single separator can make two
 * different orders compare equal.
 */
function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i])
}

/**
 * `valueWidgetsOnly`: the named keys whose live widget is a value widget, plus
 * a count of keys with no live widget at all. Those are residue the derivation
 * cannot see, which makes a form that ignores them wrong rather than merely
 * incomplete.
 */
function valueWidgetKeys(
  live: IBaseWidget[],
  named: object
): { values: string[]; orphanKeys: number } {
  const values: string[] = []
  let orphanKeys = 0
  for (const name of Object.keys(named)) {
    const widget = live.find((w) => w.name === name)
    if (!widget) orphanKeys++
    else if (isValueWidget(widget)) values.push(name)
  }
  return { values, orphanKeys }
}

/** The one case the producer suppresses by design, not a failure to emit. */
function layoutDependsOnValues(node: LGraphNode, defInputs: DefInputs) {
  try {
    return Object.values(defInputs(node) ?? {}).some((spec) =>
      VALUE_DEPENDENT_LAYOUT_INPUT_TYPES.has(String(spec.type))
    )
  } catch {
    return false
  }
}

/**
 * Why `nodeLocalWidgetForm`'s closedness test fails, or null when it holds.
 *
 * Every verdict is spelled out as a whole literal rather than interpolated:
 * that is what lets the reporter's vocabulary test read the full set out of
 * this file, in both directions.
 */
function unclosedReason(order: string[], values: string[]): string | null {
  if (order.length === 0) return 'declineUnclosed:noOrder'
  if (new Set(order).size !== order.length) return 'declineUnclosed:dupeNames'
  if (order.some((name) => !name.length)) return 'declineUnclosed:emptyName'
  if (order.length < values.length) return 'declineUnclosed:residueKeys'
  if (order.length > values.length) return 'declineUnclosed:orderOverrun'
  return null
}

/**
 * The form agrees with the named projection, which is what an agent op sends.
 * Whether it also agrees with the node's POSITIONAL widgets_values is a
 * separate question, and the answer is the post-hook drift that made the form
 * necessary: a hook that substituted the array leaves a form describing one
 * collection beside values from another.
 */
function agreementVerdict(a: number | string, serialisable: number): string {
  if (a === 'dict') return 'emitAgree:dictValues'
  if (a === 'absent') return 'emitAgree:noPositional'
  return a === serialisable ? 'emitAgree' : 'emitAgree:positionalSkew'
}

/**
 * The verdict for a node with no named projection to describe, or null when
 * there is one. The named projection is what the producer consumes; absent
 * means the node serialises no widget values at all, or the hook removed it.
 */
function noProjectionVerdict(
  sn: ISerialisedNode | undefined,
  positional: unknown,
  named: unknown
): string | null {
  if (!sn) return 'noSerialisedNode'
  if (named == null || typeof named !== 'object')
    return positional == null ? 'absent' : 'noNamed'
  return null
}

/**
 * The verdict once the derivation is closed, so a form WOULD be emitted. It is
 * only correct if the key order of the post-hook named projection is the order
 * the form declares: that is what proves the projection is still the one core
 * built from `node.widgets` rather than one an `onSerialize` hook substituted.
 */
function emittedFormVerdict(
  order: string[],
  keyOrder: string[],
  orphanKeys: number,
  a: number | string,
  serialisable: number
): string {
  if (!sameOrder(keyOrder, order)) return 'emitDisagree:keyOrder'
  if (orphanKeys) return 'emitDisagree:orphanKeys'
  return agreementVerdict(a, serialisable)
}

function classifyFormNode(
  node: LGraphNode,
  sn: ISerialisedNode | undefined,
  defInputs: DefInputs,
  src: string
): FormRow {
  const live = node.widgets ?? []
  const positional: unknown = sn?.widgets_values
  const named: unknown = sn?.widgets_values_named
  const a = positionalShape(positional)
  const at = (v: string, o = 0, k = 0): FormRow => ({
    t: node.type,
    v,
    o,
    k,
    w: live.length,
    a,
    src
  })

  const noProjection = noProjectionVerdict(sn, positional, named)
  if (noProjection) return at(noProjection)

  const { values, orphanKeys } = valueWidgetKeys(live, named as object)
  // nodeLocalWidgetForm: order is the live widget order, filtered to the keys
  // that survived. Duplicates are preserved on purpose - they are what the
  // closedness test exists to catch.
  const order = live.map((w) => w.name).filter((name) => values.includes(name))
  const o = order.length
  const k = values.length

  if (layoutDependsOnValues(node, defInputs))
    return at('declineLayoutDependent', o, k)
  const unclosed = unclosedReason(order, values)
  if (unclosed) return at(unclosed, o, k)

  const keyOrder = Object.keys(named as object).filter((name) =>
    values.includes(name)
  )
  const serialisable = live.filter((w) => w.serialize !== false).length
  return at(
    emittedFormVerdict(order, keyOrder, orphanKeys, a, serialisable),
    o,
    k
  )
}

function measureFormAgreement(
  nodes: LGraphNode[],
  byId: Map<string, ISerialisedNode>,
  defInputs: DefInputs,
  src: string
): FormRow[] {
  return nodes.map((node) =>
    classifyFormNode(node, byId.get(String(node.id)), defInputs, src)
  )
}

/**
 * The node-def lookup the form producer uses. A pack that registers a
 * value-dependent layout input type is the one case the producer suppresses by
 * design, so reading this from the real store is what keeps a deliberate
 * decline from being counted as a failure to emit. The lookup is lazy, so
 * resolving it before the battery runs is safe.
 */
async function resolveDefInputs(): Promise<DefInputs> {
  try {
    const { useNodeDefStore } = await import('@/stores/nodeDefStore')
    const defStore = useNodeDefStore()
    return (node) =>
      (
        defStore.fromLGraphNode(node) as {
          inputs?: Record<string, { type?: unknown }>
        } | null
      )?.inputs ?? null
  } catch {
    return () => {
      throw new Error('nodeDefStore unavailable')
    }
  }
}

/** Writes the form verdicts onto the row. Never throws into its caller: this
 * is telemetry riding on the `serialize` op, and it must not be able to fail
 * the op that carries it. */
function recordFormAgreement(
  row: Record<string, unknown>,
  nodes: LGraphNode[],
  serialised: { nodes: ISerialisedNode[] },
  defInputs: DefInputs,
  driven: FormRow[]
): void {
  try {
    // Keyed as strings on purpose: a live `node.id` is a string here while the
    // serialised `id` is a number, so a Map keyed on the raw value matches
    // nothing and every node reads as `noSerialisedNode`.
    const byId = new Map<string, ISerialisedNode>()
    for (const sn of serialised.nodes) byId.set(String(sn.id), sn)
    const formNodes = [
      ...measureFormAgreement(nodes, byId, defInputs, 'battery'),
      ...driven
    ]
    row.formNodes = formNodes
    const counts: Record<string, number> = {}
    for (const r of formNodes) counts[r.v] = (counts[r.v] ?? 0) + 1
    row.formAgreement = counts
  } catch (e) {
    row.formAgreement = { harnessError: errMsg(e) }
    row.formNodes = driven
  }
}

function signature(graph: LGraph, store: WidgetValueStore | undefined) {
  const nodes = [...graph._nodes]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((n) => {
      // Vue-renderer observable: the widget rows the store would draw, beside
      // the live widget array litegraph draws. r counts store rows that are
      // still live; st names every store row, so a row the pack dropped from
      // node.widgets but left in the store still shows up.
      let r: number | string = UNMEASURED
      let st = UNMEASURED
      if (store) {
        try {
          const states = store.getNodeWidgets(graph.rootGraph.id, n.id)
          const liveNames = new Set((n.widgets ?? []).map((w) => w.name))
          r = states.filter((s) => liveNames.has(s.name)).length
          st = states.map((s) => `${s.name}=${s.type}`).join(',')
        } catch {
          r = 'err'
          st = 'err'
        }
      }
      return {
        id: n.id,
        type: n.type,
        mode: n.mode,
        collapsed: !!n.flags.collapsed,
        widgets: n.widgets?.length ?? 0,
        wn: (n.widgets ?? []).map((w) => `${w.name}=${w.type}`).join(','),
        r,
        st,
        in: n.inputs.map((_, i: number) => {
          try {
            return n.isInputConnected(i) ? 1 : 0
          } catch {
            return 'e'
          }
        }),
        out: n.outputs.map((_, i: number) => {
          try {
            return n.isOutputConnected(i) ? 1 : 0
          } catch {
            return 'e'
          }
        })
      }
    })
  return S({ n: graph._nodes.length, l: graph.links.size, nodes })
}

export async function runPack(
  pack: string,
  loaders: Partial<Record<string, () => Promise<unknown>>>,
  entries: string[],
  safe: string
) {
  // Write-ahead stub: a pack that hangs past the test timeout or kills the
  // worker leaves this row behind, so the shard's rows==specs check reads
  // it as pack noise (counted, reported) instead of a harness failure.
  const dir = process.env.MATRIX_OUT ?? '/tmp/matrix'
  fs.mkdirSync(dir, { recursive: true })
  const rowPath = `${dir}/${safe}.json`
  fs.writeFileSync(rowPath, JSON.stringify({ pack, safe, incomplete: true }))
  // The app CONTAINS throwing extension hooks (extensionService catches and
  // console.errors them), so a pack whose hook throws would otherwise read
  // clean. Capture the containment signature as row data.
  const hookErrors: string[] = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(argText).join(' ').replace(/\s+/g, ' ')
    if (text.includes('Error calling extension'))
      hookErrors.push(text.slice(0, 200))
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  setActivePinia(createTestingPinia({ stubActions: false }))

  // safe is the filename this row is written under; carrying it in the row
  // lets the verdict job cross-check filename against row identity.
  const row: Record<string, unknown> = { pack, safe }
  const ops: Record<string, OpRecord> = {}
  let storeReadErrors = 0
  const { lg, app } = await installGlobals()
  const { LGraph, LiteGraph } = lg

  // ---- LOAD the pack's real entry files ---------------------------------
  const typesBefore = new Set(Object.keys(LiteGraph.registered_node_types))
  const load: Record<string, string> = {}
  for (const key of entries) {
    const fn = loaders[key]
    if (!fn) {
      load[key] = 'NO-GLOB'
      continue
    }
    try {
      await fn()
      load[key] = 'OK'
    } catch (e) {
      load[key] = errMsg(e)
    }
  }
  row.load = load
  row.loadedOk = Object.values(load).filter((v) => v === 'OK').length

  // ---- register battery defs (invokes pack beforeRegisterNodeDef) -------
  const { useLitegraphService } = await import('@/services/litegraphService')
  const svc = useLitegraphService()
  const regErrs: string[] = []
  for (const [name, d] of Object.entries(DEFS)) {
    try {
      await svc.registerNodeDef(name, {
        name,
        display_name: name,
        category: 't',
        python_module: 'nodes',
        description: '',
        output_is_list: [],
        output_node: name === 'SaveImage',
        ...d
      })
    } catch (e) {
      regErrs.push(`${name}:${errMsg(e)}`)
    }
  }
  row.registerNodeDef = regErrs.join('|') || 'OK'

  // ---- registerCustomNodes (frontend-only pack node types) --------------
  try {
    const { useExtensionService } = await import('@/services/extensionService')
    await useExtensionService().invokeExtensionsAsync('registerCustomNodes')
    row.registerCustomNodes = 'OK'
  } catch (e) {
    row.registerCustomNodes = errMsg(e)
  }
  const newTypes = Object.keys(LiteGraph.registered_node_types)
    .filter((t) => !typesBefore.has(t) && !(t in DEFS))
    .sort()
  row.newTypes = newTypes
  try {
    const { useExtensionStore } = await import('@/stores/extensionStore')
    const st = useExtensionStore()
    row.extTotal = st.extensions.length
    row.extEnabled = st.enabledExtensions.length
    row.typesTotal = Object.keys(LiteGraph.registered_node_types).length
  } catch (e) {
    row.extTotal = errMsg(e)
  }

  // ---- graph + boot-order fidelity --------------------------------------
  const graph = new LGraph()
  // ComfyApp.setup() non-null-asserts five DOM elements and needs a 2D
  // context, so it cannot boot here. DOM widgets read app.rootGraph while
  // graph.configure runs, so the private field has to be seeded directly.
  Reflect.set(app, 'rootGraphInternal', graph)
  const byType = (t: string) => graph._nodes.find((n) => n.type === t)

  let wvStore: WidgetValueStore | undefined
  try {
    const { useWidgetValueStore } = await import('@/stores/widgetValueStore')
    wvStore = useWidgetValueStore()
  } catch {
    wvStore = undefined
  }
  row.storeMeasured = !!wvStore

  const defInputs = await resolveDefInputs()

  // LGraphCanvas cannot be constructed under happy-dom ("This browser doesn't
  // support Canvas"), but BaseWidget.setValue only reads graph_mouse off it
  // and hands it to widget.callback. A prototype-backed stand-in keeps the
  // real method surface for pack callbacks that reach for one.
  const canvas: LGraphCanvas = Object.assign(
    Object.create(lg.LGraphCanvas.prototype) as LGraphCanvas,
    { graph_mouse: [0, 0] as Point, graph }
  )
  const pointerEvent: CanvasPointerEvent = Object.assign(
    new PointerEvent('pointerdown'),
    {
      canvasX: 0,
      canvasY: 0,
      deltaX: 0,
      deltaY: 0,
      safeOffsetX: 0,
      safeOffsetY: 0
    }
  )

  // The real edit path: setValue fires widget.callback, node.onWidgetChanged
  // and graph.incrementVersion(). A bare `w.value =` fires none of them.
  const editWidgetValue = (
    node: LGraphNode | undefined,
    name: string,
    value: number | string
  ) => {
    const widget = node?.widgets?.find((w) => w.name === name)
    if (!node || !widget) {
      NOTE = 'no target widget'
      DISPATCHED = false
      return
    }
    if (widget instanceof lg.BaseWidget) {
      widget.setValue(value, { e: pointerEvent, node, canvas })
      return
    }
    widget.value = value
    NOTE = 'plain-object widget: assigned, setValue unavailable'
    DISPATCHED = false
  }

  /** `nodeId:widgetName` of every row the battery desynced deliberately. */
  const mangled = new Set<string>()

  // dispatching=false marks an op that is a bare property or array write with
  // no call into the app: its err channel cannot fail, so the summarizer must
  // exclude it from the gated cleanliness percentage.
  async function op(name: string, fn: () => unknown, dispatching = true) {
    DEPR = []
    NOTE = ''
    DISPATCHED = dispatching
    let err = ''
    try {
      await fn()
    } catch (e) {
      err = errMsg(e)
    }
    let sig: string
    try {
      sig = signature(graph, wvStore)
    } catch (e) {
      sig = 'SIGFAIL ' + errMsg(e)
    }
    // Vue-renderer desync: a live widget row the store does not back, or backs
    // with a different type. Rows the battery mangled itself are skipped -
    // they diverge by construction and are permanent once made, so leaving
    // them in would mask a real divergence on every op that follows.
    let desync = ''
    try {
      const d = JSON.parse(sig) as { nodes?: SigNode[] }
      storeReadErrors += (d.nodes ?? []).filter((n) => n.r === 'err').length
      const bad = (d.nodes ?? []).filter((n) => {
        if (n.r === 'err') return true
        if (typeof n.r !== 'number') return false
        const rows = (csv: unknown) =>
          String(csv ?? '')
            .split(',')
            .filter((e) => e && !mangled.has(`${n.id}:${e.split('=')[0]}`))
        const live = rows(n.wn).sort()
        const stored = rows(n.st).sort()
        const liveNames = new Set(live.map((e) => e.split('=')[0]))
        const backed = stored.filter((e) => liveNames.has(e.split('=')[0]))
        return (
          backed.length !== live.length || stored.join(',') !== live.join(',')
        )
      })
      if (bad.length)
        desync = bad
          .map((n) => `${n.type}#${n.id}(w${n.widgets}/r${n.r})`)
          .join(';')
    } catch {
      /* sig unparseable */
    }
    ops[name] = {
      err,
      sig,
      depr: [...new Set(DEPR)].sort().join('|'),
      desync,
      dispatching: DISPATCHED,
      note: NOTE
    }
  }

  // ---- the user-operation battery ---------------------------------------
  await op('load', () =>
    graph.configure(
      structuredClone(defaultWorkflow) as unknown as Parameters<
        typeof graph.configure
      >[0]
    )
  )
  // Harness self-check: if the default workflow did not materialize, the
  // if-guarded ops below would all no-op and report a vacuously clean pack.
  // The summarizer withholds the verdict when this fails broadly. Floors of
  // one below today's workflow (7 nodes / 7 KSampler widgets): tolerate a
  // legitimate upstream edit removing one item, but a graph missing more
  // than that would run the battery vacuously and must read as degraded.
  const kAfterLoad = byType('KSampler')
  row.selfCheck =
    graph._nodes.length >= 6 && (kAfterLoad?.widgets?.length ?? 0) >= 6
      ? 'OK'
      : `default workflow degraded: nodes=${graph._nodes.length}` +
        ` kSamplerWidgets=${kAfterLoad?.widgets?.length ?? 0}`
  await op('editWidget', () => {
    editWidgetValue(byType('KSampler'), 'seed', 123456)
  })
  await op('editText', () => {
    editWidgetValue(byType('CLIPTextEncode'), 'text', 'a cat wearing a hat')
  })
  await op(
    'mute',
    () => {
      const n = byType('SaveImage')
      if (n) n.mode = 2
    },
    false
  )
  await op(
    'bypass',
    () => {
      const n = byType('VAEDecode')
      if (n) n.mode = 4
    },
    false
  )
  await op('collapse', () => {
    byType('EmptyLatentImage')?.collapse()
  })
  await op('move', () => {
    const n = byType('KSampler')
    if (n) n.setPos(n.pos[0] + 40, n.pos[1] + 25)
  })
  await op('resize', () => {
    const n = byType('CLIPTextEncode')
    if (n) n.setSize([n.size[0], n.size[1] + 60])
  })
  await op('disconnect', () => {
    byType('KSampler')?.disconnectInput(0)
  })
  await op('reconnect', () => {
    const k = byType('KSampler')
    const ck = byType('CheckpointLoaderSimple')
    if (k && ck) ck.connect(0, k, 0)
  })
  await op(
    'wSplice',
    () => {
      const k = byType('KSampler')
      const removed = k?.widgets?.splice(0, 1)[0]
      if (k && removed) mangled.add(`${k.id}:${removed.name}`)
    },
    false
  )
  await op(
    'wReorder',
    () => {
      const w = byType('KSampler')?.widgets
      if (w && w.length > 1) w.splice(0, 0, w.splice(w.length - 1, 1)[0])
    },
    false
  )
  await op(
    'wConvert',
    () => {
      const k = byType('KSampler')
      const w: ConvertibleWidget | undefined = k?.widgets?.find(
        (x) => x.name === 'steps'
      )
      if (k && w) {
        w.origType = w.type
        w.origComputeSize = w.computeSize
        w.computeSize = () => [0, -4]
        w.type = 'converted-widget'
        mangled.add(`${k.id}:${w.name}`)
      }
    },
    false
  )
  await op(
    'wPushPojo',
    () => {
      const k = byType('KSampler')
      k?.widgets?.push({
        name: 'XPOJO',
        type: 'X.CUSTOM',
        value: 1,
        options: {},
        y: 0,
        computeSize: () => [100, 20]
      })
      if (k) mangled.add(`${k.id}:XPOJO`)
    },
    false
  )
  await op('wPushForeignClass', () => {
    class ForeignWidget {
      [symbol: symbol]: boolean
      name = 'XFOREIGN'
      type = 'X.FOREIGN'
      value = 1
      options = {}
      y = 0

      draw() {
        return 'draw'
      }

      mouse() {
        return true
      }

      computeSize() {
        return [101, 21] as [number, number]
      }
    }

    const k = byType('KSampler')
    if (!k) return
    const foreignWidget = new ForeignWidget()
    const expectedWidget = new ForeignWidget()
    const widgetMethods = ['draw', 'mouse', 'computeSize'] as const
    k.addCustomWidget(foreignWidget)
    mangled.add(`${k.id}:XFOREIGN`)

    const widget = k.widgets?.find((item) => item.name === 'XFOREIGN')
    const prototypeMethods = widgetMethods.filter(
      (method) => widget?.[method] !== expectedWidget[method]
    )
    if (prototypeMethods.length)
      throw new Error(
        `foreign widget prototype methods lost: ${prototypeMethods.join(',')}`
      )
  })
  await op('addNode', () => {
    const n = LiteGraph.createNode('EmptyLatentImage')
    if (n) {
      n.pos = [900, 900]
      graph.add(n)
    }
  })
  await op('deleteNode', () => {
    const extra = [...graph._nodes]
      .reverse()
      .find((n) => n.type === 'EmptyLatentImage')
    if (extra) graph.remove(extra)
  })
  await op('addReroute', () => {
    const link = [...graph.links.values()].at(0)
    if (link) graph.createReroute([500, 500], link)
  })

  // ---- drive the pack's OWN frontend-registered node types --------------
  const driven: Record<string, string> = {}
  // Form verdicts for the pack's own classes. These are where a custom
  // serializer actually lives, and the battery's nodes never carry one, so
  // without this arm the measurement only ever sees packs through their hooks.
  const formDriven: FormRow[] = []
  for (const t of newTypes.slice(0, 8)) {
    DEPR = []
    try {
      const n = LiteGraph.createNode(t)
      if (!n) {
        driven[t] = 'createNode null'
        continue
      }
      n.pos = [1200, 100]
      graph.add(n)
      const parts = [
        `in=${n.inputs.length}`,
        `out=${n.outputs.length}`,
        `w=${n.widgets?.length ?? 0}`
      ]
      // try a wildcard-friendly connection into its first input
      if (n.inputs.length) {
        const ck = byType('CheckpointLoaderSimple')
        try {
          const r = ck?.connect(0, n, 0)
          parts.push(`conn=${r ? 'ok' : 'null'}`)
          parts.push(`in0type=${n.inputs[0]?.type}`)
          if (r) n.disconnectInput(0)
        } catch (e) {
          parts.push(`conn=THREW ${errMsg(e).slice(0, 40)}`)
        }
      }
      const sn = n.serialize()
      formDriven.push(
        ...measureFormAgreement(
          [n],
          new Map([[String(n.id), sn]]),
          defInputs,
          'driven'
        )
      )
      graph.remove(n)
      if (DEPR.length)
        parts.push(`depr=${[...new Set(DEPR)].join(';').slice(0, 60)}`)
      driven[t] = parts.join(' ')
    } catch (e) {
      driven[t] = 'THREW ' + errMsg(e)
    }
  }
  row.driveTypes = driven

  await op('serialize', () => {
    const serialised = graph.serialize()
    row.serialized = S(serialised)
    recordFormAgreement(row, graph._nodes, serialised, defInputs, formDriven)
  })
  await op('reload', () => {
    const g2 = new LGraph()
    g2.configure(
      structuredClone(JSON.parse(String(row.serialized ?? '{}'))) as Parameters<
        typeof g2.configure
      >[0]
    )
    row.reloadedNodes = g2._nodes.length
  })
  await op('graphToPrompt', async () => {
    const p = await app.graphToPrompt(graph)
    row.prompt = S(p.output)
  })

  row.ops = ops
  row.storeReadErrors = storeReadErrors
  row.hookErrors = [...new Set(hookErrors)].slice(0, 20)
  row.vueNodesMode = LiteGraph.vueNodesMode

  fs.writeFileSync(rowPath, JSON.stringify(row))
}
