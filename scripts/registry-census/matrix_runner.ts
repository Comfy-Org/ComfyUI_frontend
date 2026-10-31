import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'

import defaultWorkflow from '../../browser_tests/assets/default.json'
import type {
  ISerialisedNode,
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { PointTuple as Point } from '@comfyorg/shared-frontend-utils/geometry'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { WidgetFormProof } from '@/lib/litegraph/src/widgets/widgetFormProof'
import {
  needsFormButHasNone,
  proveWidgetForm
} from '@/lib/litegraph/src/widgets/widgetFormProof'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import type { useWidgetValueStore } from '@/stores/widgetValueStore'
import type * as WidgetValuesForm from '@/workbench/extensions/agent/crdt/widgetValuesForm'

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

const UNMEASURED = 'unmeasured'

const MAX_DRIVEN_TYPES_PER_PACK = 64

type WidgetValueStore = ReturnType<typeof useWidgetValueStore>

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

type WidgetFormRefusal = NonNullable<WidgetFormProof['refusal']>

type FormVerdict =
  | 'provable'
  | WidgetFormRefusal
  | (typeof HARNESS_VERDICT)[keyof typeof HARNESS_VERDICT]

interface FormProof {
  graph: Record<string, FormVerdict>
  driven: Record<string, FormVerdict>
  needsForm: string[]
  err?: string
}

const NOT_CAPTURED = Symbol('widgets_values not captured')

const HARNESS_VERDICT = {
  threw: '!serialize_threw',
  uncreatable: '!createNode_null',
  unnamed: '!no_refusal_named'
} as const

function coreIsLastWriter(node: LGraphNode, base: typeof LGraphNode): boolean {
  return (
    node.serializeFromStoreState === base.prototype.serializeFromStoreState &&
    node.serialize === base.prototype.serialize
  )
}

interface Capture {
  serialised: ISerialisedNode
  produced: unknown
  captured: boolean
}

function captureSerialization(node: LGraphNode): Capture | null {
  const descriptor = Object.getOwnPropertyDescriptor(node, 'onSerialize')
  const inherited = node.onSerialize
  let produced: unknown = NOT_CAPTURED
  node.onSerialize = function (serialised: ISerialisedNode) {
    produced = serialised.widgets_values
    inherited?.call(this, serialised)
  }
  try {
    const serialised = node.serialize()
    return {
      serialised,
      produced: produced === NOT_CAPTURED ? undefined : produced,
      captured: produced !== NOT_CAPTURED
    }
  } catch {
    return null
  } finally {
    if (descriptor) Object.defineProperty(node, 'onSerialize', descriptor)
    else Reflect.deleteProperty(node, 'onSerialize')
  }
}

function verdictOf(
  widgets: readonly IBaseWidget[] | undefined,
  serialised: { widgets_values?: unknown; has_errors?: boolean },
  producedValues: unknown,
  options: {
    serializeWidgets?: boolean
    replayed: boolean
    lastWriter: boolean
  }
): { verdict: FormVerdict; order: string[] | null } {
  const proof = proveWidgetForm(widgets, serialised, producedValues, {
    serializeWidgets: options.serializeWidgets,
    replayed: options.replayed,
    coreIsLastWriter: options.lastWriter
  })
  return {
    verdict: proof.provable
      ? 'provable'
      : (proof.refusal ?? HARNESS_VERDICT.unnamed),
    order: proof.order
  }
}

function proveNodeForm(
  node: LGraphNode,
  base: typeof LGraphNode
): { verdict: FormVerdict; needsForm: boolean } {
  const capture = captureSerialization(node)
  if (!capture) return { verdict: HARNESS_VERDICT.threw, needsForm: false }
  const { verdict } = verdictOf(
    node.widgets,
    capture.serialised,
    capture.captured ? capture.produced : undefined,
    {
      serializeWidgets: node.serialize_widgets,
      replayed: !capture.captured && !!node.last_serialization,
      lastWriter: coreIsLastWriter(node, base)
    }
  )
  return { verdict, needsForm: needsFormButHasNone(capture.serialised) }
}

function proveFreshNode(
  graph: LGraph,
  type: string,
  createNode: (type: string) => LGraphNode | null,
  base: typeof LGraphNode
): { verdict: FormVerdict; needsForm: boolean } {
  try {
    const node = createNode(type)
    if (!node) return { verdict: HARNESS_VERDICT.uncreatable, needsForm: false }
    node.pos = [1400, 100]
    graph.add(node)
    try {
      return proveNodeForm(node, base)
    } finally {
      graph.remove(node)
    }
  } catch {
    return { verdict: HARNESS_VERDICT.threw, needsForm: false }
  }
}

function measureFormProof(
  graph: LGraph,
  packTypes: string[],
  createNode: (type: string) => LGraphNode | null,
  base: typeof LGraphNode
): FormProof {
  const agreement: FormProof = { graph: {}, driven: {}, needsForm: [] }
  try {
    for (const node of graph._nodes) {
      const key = `${node.type}#${String(node.id)}`
      const { verdict, needsForm } = proveNodeForm(node, base)
      agreement.graph[key] = verdict
      if (needsForm) agreement.needsForm.push(key)
    }
    for (const type of packTypes) {
      const { verdict, needsForm } = proveFreshNode(
        graph,
        type,
        createNode,
        base
      )
      agreement.driven[type] = verdict
      if (needsForm) agreement.needsForm.push(type)
    }
  } catch (e) {
    agreement.err = errMsg(e)
  }
  return agreement
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

type ShapeDef = Partial<ComfyNodeDef> & { python_module?: string }

const SHAPE_RELATIVE = 'scripts/registry-census/object_info.shape.json'

export function shapeDefsPath(): string {
  const override = process.env.MATRIX_OBJECT_INFO
  return override ? path.resolve(override) : path.resolve(SHAPE_RELATIVE)
}

export function loadShapeDefs(): Record<string, ShapeDef> {
  const file = shapeDefsPath()
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(
      `object_info shape projection unreadable at ${file}: ${errMsg(e)}`,
      { cause: e }
    )
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} is not an /object_info object`)
  }
  const defs = parsed as Record<string, ShapeDef>
  if (!Object.keys(defs).length) throw new Error(`${file} carries no classes`)
  return defs
}

interface PristineSerialization {
  serialize: unknown
  serializeFromStoreState: unknown
}

export function captureSerializationEntryPoints(
  base: typeof LGraphNode
): PristineSerialization {
  return {
    serialize: base.prototype.serialize,
    serializeFromStoreState: base.prototype.serializeFromStoreState
  }
}

interface SubgraphFormProbe {
  scenario: string
  verdict?: FormVerdict
  needsForm?: boolean
  coreIsLastWriter?: boolean
  widgets?: number
  ifAssumedFinal?: FormVerdict
  ifAssumedFinalAtHookSite?: FormVerdict
  wrongOrder?: string[] | null
  finalValues?: unknown
  err?: string
}

export interface RegistryFormCensus {
  source: string
  classes: number
  registered: number
  registerErrors: string[]
  histogram: Record<string, number>
  refusals: Record<string, FormVerdict>
  needsForm: string[]
  byModule: Record<string, [number, number]>
  digest: string
  subgraph: SubgraphFormProbe[]
  prototypePatched: { serialize: boolean; serializeFromStoreState: boolean }
  hookErrors: string[]
  err?: string
}

async function registerShapeDefs(
  defs: Record<string, ShapeDef>
): Promise<{ registered: number; errors: string[] }> {
  const { useLitegraphService } = await import('@/services/litegraphService')
  const svc = useLitegraphService()
  const errors: string[] = []
  let registered = 0
  for (const [name, def] of Object.entries(defs)) {
    try {
      await svc.registerNodeDef(name, {
        name,
        display_name: name,
        category: def.category ?? 'census',
        python_module: def.python_module ?? 'nodes',
        description: '',
        output_is_list: def.output_is_list ?? [],
        output_node: def.output_node ?? false,
        ...def
      })
      registered++
    } catch (e) {
      if (errors.length < 40) errors.push(`${name}:${errMsg(e)}`)
    }
  }
  return { registered, errors }
}

async function buildSubgraphHost(
  lg: { LGraph: typeof LGraph },
  createNode: (type: string) => LGraphNode | null
): Promise<LGraphNode> {
  const graph = new lg.LGraph()
  const { useSubgraphService } = await import('@/services/subgraphService')
  graph.events.addEventListener('subgraph-created', (e) => {
    const { subgraph, data } = e.detail
    useSubgraphService().registerNewSubgraph(subgraph, data)
  })

  const inner = createNode('CLIPTextEncode')
  const source = createNode('PrimitiveString')
  if (!inner || !source) throw new Error('could not create the probe nodes')
  graph.add(inner)
  graph.add(source)
  const textSlot = inner.inputs.findIndex((input) => input.name === 'text')
  if (textSlot < 0) throw new Error('CLIPTextEncode has no text input slot')
  if (!source.connect(0, inner, textSlot))
    throw new Error('could not connect the promotable widget input')
  return graph.convertToSubgraph(new Set([inner])).node
}

async function probeSubgraphForm(
  lg: { LGraph: typeof LGraph; LGraphNode: typeof LGraphNode },
  createNode: (type: string) => LGraphNode | null,
  scenario: string,
  dress: (host: LGraphNode) => void
): Promise<SubgraphFormProbe> {
  try {
    const host = await buildSubgraphHost(lg, createNode)
    dress(host)
    const capture = captureSerialization(host)
    if (!capture) return { scenario, err: 'host serialize threw' }
    const shared = {
      serializeWidgets: host.serialize_widgets,
      replayed: !capture.captured && !!host.last_serialization
    }
    const produced = capture.captured ? capture.produced : undefined
    const actual = verdictOf(host.widgets, capture.serialised, produced, {
      ...shared,
      lastWriter: coreIsLastWriter(host, lg.LGraphNode)
    })
    const atReturn = verdictOf(host.widgets, capture.serialised, produced, {
      ...shared,
      lastWriter: true
    })
    const atHook = verdictOf(
      host.widgets,
      { widgets_values: produced },
      produced,
      { ...shared, lastWriter: true }
    )
    return {
      scenario,
      verdict: actual.verdict,
      needsForm: needsFormButHasNone(capture.serialised),
      coreIsLastWriter: coreIsLastWriter(host, lg.LGraphNode),
      widgets: host.widgets?.length ?? 0,
      ifAssumedFinal: atReturn.verdict,
      ifAssumedFinalAtHookSite: atHook.verdict,
      wrongOrder: atHook.order,
      finalValues: capture.serialised.widgets_values
    }
  } catch (e) {
    return { scenario, err: errMsg(e) }
  }
}

const SUBGRAPH_SCENARIOS: {
  scenario: string
  dress: (host: LGraphNode) => void
}[] = [
  { scenario: 'promoted-only', dress: () => {} },
  {
    scenario: 'plus-custom-widget',
    dress: (host) => {
      host.addCustomWidget({
        name: 'EXTRA',
        type: 'X.EXTRA',
        value: 1,
        options: {},
        y: 0,
        computeSize: () => [100, 20]
      } as unknown as IBaseWidget)
    }
  }
]

function emptyCensus(source: string, classes: number): RegistryFormCensus {
  return {
    source,
    classes,
    registered: 0,
    registerErrors: [],
    histogram: {},
    refusals: {},
    needsForm: [],
    byModule: {},
    digest: '',
    subgraph: [],
    prototypePatched: { serialize: false, serializeFromStoreState: false },
    hookErrors: []
  }
}

function recordVerdict(
  census: RegistryFormCensus,
  name: string,
  module: string,
  verdict: FormVerdict,
  needsForm: boolean
): void {
  census.histogram[verdict] = (census.histogram[verdict] ?? 0) + 1
  if (verdict !== 'provable') census.refusals[name] = verdict
  if (needsForm) census.needsForm.push(name)
  const rollup = (census.byModule[module] ??= [0, 0])
  rollup[1]++
  if (verdict === 'provable') rollup[0]++
}

export async function censusRegistryForms(options: {
  lg: { LGraph: typeof LGraph; LGraphNode: typeof LGraphNode }
  createNode: (type: string) => LGraphNode | null
  seedRootGraph: (graph: LGraph) => void
  pristine: PristineSerialization
  drainHookErrors: () => string[]
}): Promise<RegistryFormCensus> {
  const { lg, createNode, seedRootGraph, pristine, drainHookErrors } = options
  let census = emptyCensus(shapeDefsPath(), 0)
  try {
    const defs = loadShapeDefs()
    census = emptyCensus(shapeDefsPath(), Object.keys(defs).length)
    drainHookErrors()
    const { registered, errors } = await registerShapeDefs(defs)
    census.registered = registered
    census.registerErrors = errors

    const graph = new lg.LGraph()
    seedRootGraph(graph)
    const verdicts: string[] = []
    for (const name of Object.keys(defs).sort()) {
      const { verdict, needsForm } = proveFreshNode(
        graph,
        name,
        createNode,
        lg.LGraphNode
      )
      recordVerdict(
        census,
        name,
        defs[name].python_module ?? 'unknown',
        verdict,
        needsForm
      )
      verdicts.push(`${name}=${verdict}`)
    }
    census.digest = crypto
      .createHash('sha256')
      .update(verdicts.join('\n'))
      .digest('hex')
    for (const { scenario, dress } of SUBGRAPH_SCENARIOS) {
      census.subgraph.push(
        await probeSubgraphForm(lg, createNode, scenario, dress)
      )
    }
    census.prototypePatched = {
      serialize: lg.LGraphNode.prototype.serialize !== pristine.serialize,
      serializeFromStoreState:
        lg.LGraphNode.prototype.serializeFromStoreState !==
        pristine.serializeFromStoreState
    }
    census.hookErrors = [...new Set(drainHookErrors())].slice(0, 20)
  } catch (e) {
    census.err = errMsg(e)
  }
  return census
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

interface FormRow {
  t: string
  v: string
  o: number
  k: number
  w: number
  a: number | string
  src: string
}

type FormProducer = typeof WidgetValuesForm

function positionalShape(positional: unknown): number | string {
  if (Array.isArray(positional)) return positional.length
  return positional == null ? 'absent' : 'dict'
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i])
}

function agreementVerdict(a: number | string, serialisable: number): string {
  if (a === 'dict') return 'emitAgree:dictValues'
  if (a === 'absent') return 'emitAgree:noPositional'
  return a === serialisable ? 'emitAgree' : 'emitAgree:positionalSkew'
}

function declineVerdict(reason: string): string {
  return `decline:${reason}`
}

function emittedFormVerdict(
  order: readonly string[],
  keyOrder: string[],
  a: number | string,
  serialisable: number
): string {
  const canonicalOrder = Object.keys(
    Object.fromEntries(order.map((n) => [n, true]))
  )
  if (!sameOrder(keyOrder, canonicalOrder)) return 'emitDisagree:keyOrder'
  return agreementVerdict(a, serialisable)
}

function classifyFormNode(
  node: LGraphNode,
  sn: ISerialisedNode | undefined,
  producer: FormProducer,
  src: string
): FormRow {
  const live = node.widgets ?? []
  const positional: unknown = sn?.widgets_values
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

  if (!sn) return at('noSerialisedNode')
  const named = sn.widgets_values_named
  if (named == null || typeof named !== 'object')
    return at(positional == null ? 'absent' : 'noNamed')
  if (node.isVirtualNode) return at('decline:virtual_node')

  const values = producer.valueWidgetsOnly(node, named)
  const keyOrder = Object.keys(values)
  const verdict = producer.classifyWidgetValuesForm(node, values, sn)
  if (!verdict.declared)
    return at(declineVerdict(verdict.reason), 0, keyOrder.length)

  const { order } = verdict.form
  const serialisable = live.filter((w) => w.serialize !== false).length
  return at(
    emittedFormVerdict(order, keyOrder, a, serialisable),
    order.length,
    keyOrder.length
  )
}

function measureFormAgreement(
  nodes: LGraphNode[],
  byId: Map<string, ISerialisedNode>,
  producer: FormProducer,
  src: string
): FormRow[] {
  return nodes.map((node) =>
    classifyFormNode(node, byId.get(String(node.id)), producer, src)
  )
}

function recordFormAgreement(
  row: Record<string, unknown>,
  nodes: LGraphNode[],
  serialised: { nodes: ISerialisedNode[] },
  producer: FormProducer,
  driven: FormRow[],
  measurementErrors: string[]
): void {
  try {
    const byId = new Map<string, ISerialisedNode>()
    for (const sn of serialised.nodes) byId.set(String(sn.id), sn)
    const formNodes = [
      ...measureFormAgreement(nodes, byId, producer, 'battery'),
      ...driven
    ]
    row.formNodes = formNodes
    const counts: Record<string, number> = {}
    for (const r of formNodes) counts[r.v] = (counts[r.v] ?? 0) + 1
    row.formAgreement = measurementErrors.length
      ? { ...counts, harnessError: measurementErrors.join(' | ') }
      : counts
  } catch (e) {
    row.formAgreement = {
      harnessError: [...measurementErrors, errMsg(e)].join(' | ')
    }
    row.formNodes = driven
  }
}

function signature(graph: LGraph, store: WidgetValueStore | undefined) {
  const nodes = [...graph._nodes]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((n) => {
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
  const dir = process.env.MATRIX_OUT ?? '/tmp/matrix'
  fs.mkdirSync(dir, { recursive: true })
  const rowPath = `${dir}/${safe}.json`
  fs.writeFileSync(rowPath, JSON.stringify({ pack, safe, incomplete: true }))
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

  const row: Record<string, unknown> = { pack, safe }
  const ops: Record<string, OpRecord> = {}
  let storeReadErrors = 0
  const { lg, app } = await installGlobals()
  const { LGraph, LiteGraph } = lg
  const pristine = captureSerializationEntryPoints(lg.LGraphNode)

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

  const { useLitegraphService } = await import('@/services/litegraphService')
  const svc = useLitegraphService()
  const regErrs: string[] = []
  const batteryDefs = Object.entries(DEFS).map(([name, d]) => ({
    name,
    display_name: name,
    category: 't',
    python_module: 'nodes',
    description: '',
    output_is_list: [],
    output_node: name === 'SaveImage',
    ...d
  }))
  for (const nodeDef of batteryDefs) {
    try {
      await svc.registerNodeDef(nodeDef.name, nodeDef)
    } catch (e) {
      regErrs.push(`${nodeDef.name}:${errMsg(e)}`)
    }
  }
  const { useNodeDefStore } = await import('@/stores/nodeDefStore')
  useNodeDefStore().updateNodeDefs(batteryDefs)
  row.registerNodeDef = regErrs.join('|') || 'OK'

  try {
    const { useExtensionService } =
      await import('@/platform/extensions/services/extensionService')
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
    const { useExtensionStore } =
      await import('@/platform/extensions/stores/extensionStore')
    const st = useExtensionStore()
    row.extTotal = st.extensions.length
    row.extEnabled = st.enabledExtensions.length
    row.typesTotal = Object.keys(LiteGraph.registered_node_types).length
  } catch (e) {
    row.extTotal = errMsg(e)
  }

  const graph = new LGraph()
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

  const formProducer =
    await import('@/workbench/extensions/agent/crdt/widgetValuesForm')

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

  const mangled = new Set<string>()

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
      desync = ''
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

  await op('load', () =>
    graph.configure(
      structuredClone(defaultWorkflow) as unknown as Parameters<
        typeof graph.configure
      >[0]
    )
  )
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

  const driven: Record<string, string> = {}
  const formDriven: FormRow[] = []
  const formMeasurementErrors: string[] = []
  const selectedTypes = newTypes.slice(0, MAX_DRIVEN_TYPES_PER_PACK)
  row.driveTypesOmitted = newTypes.length - selectedTypes.length
  for (const t of selectedTypes) {
    DEPR = []
    try {
      const n = LiteGraph.createNode(t)
      if (!n) {
        driven[t] = 'createNode null'
        formDriven.push({
          t,
          v: 'noSerialisedNode',
          o: 0,
          k: 0,
          w: 0,
          a: 'absent',
          src: 'driven'
        })
        continue
      }
      n.pos = [1200, 100]
      graph.add(n)
      const parts = [
        `in=${n.inputs.length}`,
        `out=${n.outputs.length}`,
        `w=${n.widgets?.length ?? 0}`
      ]
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
      try {
        formDriven.push(
          ...measureFormAgreement(
            [n],
            new Map([[String(n.id), sn]]),
            formProducer,
            'driven'
          )
        )
      } catch (e) {
        const message = errMsg(e)
        parts.push(`form=THREW ${message.slice(0, 40)}`)
        formMeasurementErrors.push(`${t}: ${message}`)
      }
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
    recordFormAgreement(
      row,
      graph._nodes,
      serialised,
      formProducer,
      formDriven,
      formMeasurementErrors
    )
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

  row.formProof = measureFormProof(
    graph,
    newTypes.slice(0, 8),
    (t) => LiteGraph.createNode(t),
    lg.LGraphNode
  )
  row.registryForms = await censusRegistryForms({
    lg,
    createNode: (t) => LiteGraph.createNode(t),
    seedRootGraph: (g) => Reflect.set(app, 'rootGraphInternal', g),
    pristine,
    drainHookErrors: () => hookErrors.splice(0, hookErrors.length)
  })

  fs.writeFileSync(rowPath, JSON.stringify(row))
}

export async function runRegistryCensus(outPath: string): Promise<void> {
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

  const { lg, app } = await installGlobals()
  const pristine = captureSerializationEntryPoints(lg.LGraphNode)
  const census = await censusRegistryForms({
    lg,
    createNode: (t) => lg.LiteGraph.createNode(t),
    seedRootGraph: (g) => Reflect.set(app, 'rootGraphInternal', g),
    pristine,
    drainHookErrors: () => hookErrors.splice(0, hookErrors.length)
  })
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { pack: BASELINE_PACK, safe: BASELINE_PACK, registryForms: census },
      null,
      1
    )
  )
}

export const BASELINE_PACK = '_registry-baseline'
