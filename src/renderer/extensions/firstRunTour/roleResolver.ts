import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { NodeId } from '@/types/nodeId'
import { toNodeId } from '@/types/nodeId'

import type {
  MediaKind,
  NodeRole,
  PromptRole,
  ResolvedRoles
} from './tourSequence'

/**
 * A minimal, faithful view of the parts of a workflow the resolver reads,
 * projected from a serialized `ComfyWorkflowJSON` (see {@link fromWorkflowJson}).
 * Keeping the resolver on this view makes it pure and testable against real
 * template JSON without instantiating a live graph.
 */
export interface WorkflowGraph {
  nodes: WorkflowGraphNode[]
  subgraphs: WorkflowSubgraph[]
}

interface WorkflowGraphNode {
  id: NodeId
  type: string
  inputs: WorkflowInput[]
  /** True when this node hosts a subgraph, keyed to a {@link WorkflowSubgraph}. */
  subgraphId: string | null
  hasOutgoingLinks: boolean
}

interface WorkflowInput {
  name: string
  /** Origin of the link feeding this input, or null when driven by its widget. */
  origin: WorkflowLinkOrigin | null
}

interface WorkflowSubgraph {
  id: string
  nodes: WorkflowGraphNode[]
  exposedInputs: ExposedInput[]
}

interface ExposedInput {
  name: string
  type: string
  label: string | null
  slot: number
}

/** Where a link originates: an inner node, or the subgraph's input boundary. */
type WorkflowLinkOrigin =
  | { kind: 'node'; nodeId: NodeId; slot: number }
  | { kind: 'boundary'; slot: number }

/**
 * Sink node types that terminate a generation, and the media each yields. A Map
 * (not an object) so an attacker-crafted `node.type` like `"constructor"` can't
 * match a prototype member and smuggle a non-`MediaKind` value through.
 */
const SINK_MEDIA = new Map<string, MediaKind>([
  ['SaveImage', 'image'],
  ['PreviewImage', 'image'],
  ['SaveAnimatedWEBP', 'image'],
  ['SaveVideo', 'video'],
  ['VHS_VideoCombine', 'video'],
  ['SaveWEBM', 'video']
])

const IMAGE_SOURCE_TYPES = new Set([
  'LoadImage',
  'LoadImageMask',
  'LoadImageOutput'
])

const SAMPLER_TYPES = new Set([
  'KSampler',
  'KSamplerAdvanced',
  'SamplerCustom',
  'SamplerCustomAdvanced'
])

/**
 * A read of the node registry, injected so the resolver stays pure and testable
 * without a live `nodeDefStore`. Returns null for unknown types.
 */
export type NodeDefLookup = (
  type: string
) => { isOutputNode: boolean; producesVideo: boolean } | null

/** Exposed-port names/labels that mark the editable prompt boundary. */
const PROMPT_PORT_NAMES = new Set(['prompt', 'text', 'value'])

const CLIP_TEXT_ENCODE = 'CLIPTextEncode'
const PROMPT_PRIMITIVE = 'PrimitiveStringMultiline'

/** Pinned node ids for a curated template — a confidence layer over heuristics. */
interface TemplateOverride {
  sourceNodeId?: NodeId
  promptNodeId: NodeId
  engineNodeId: NodeId
  sinkNodeId: NodeId
  mediaKind: MediaKind
}

export type CuratedTemplateId =
  | 'image_krea2_turbo_t2i'
  | 'image_z_image_turbo'
  | 'video_ltx2_3_i2v'
  | 'video_wan2_2_14B_i2v'
  | 'flux_kontext_dev_basic'

export const templateOverrides: Record<CuratedTemplateId, TemplateOverride> = {
  image_krea2_turbo_t2i: {
    promptNodeId: toNodeId(19),
    engineNodeId: toNodeId(3),
    sinkNodeId: toNodeId(29),
    mediaKind: 'image'
  },
  image_z_image_turbo: {
    promptNodeId: toNodeId(27),
    engineNodeId: toNodeId(3),
    sinkNodeId: toNodeId(9),
    mediaKind: 'image'
  },
  video_ltx2_3_i2v: {
    sourceNodeId: toNodeId(269),
    promptNodeId: toNodeId(319),
    engineNodeId: toNodeId(283),
    sinkNodeId: toNodeId(75),
    mediaKind: 'video'
  },
  video_wan2_2_14B_i2v: {
    sourceNodeId: toNodeId(97),
    promptNodeId: toNodeId(93),
    engineNodeId: toNodeId(86),
    sinkNodeId: toNodeId(108),
    mediaKind: 'video'
  },
  flux_kontext_dev_basic: {
    sourceNodeId: toNodeId(190),
    promptNodeId: toNodeId(6),
    engineNodeId: toNodeId(31),
    sinkNodeId: toNodeId(136),
    mediaKind: 'image'
  }
}

interface SinkMatch {
  node: WorkflowGraphNode
  mediaKind: MediaKind
}

function findSink(
  graph: WorkflowGraph,
  nodeDefLookup: NodeDefLookup
): SinkMatch | null {
  const candidates = graph.nodes.flatMap((node) => {
    const mediaKind = SINK_MEDIA.get(node.type)
    return mediaKind ? [{ node, mediaKind }] : []
  })
  if (candidates.length === 0) return findRegistrySink(graph, nodeDefLookup)

  const isSave = (match: SinkMatch) => match.node.type.startsWith('Save')
  const [best] = candidates.sort((a, b) => {
    if (isSave(a) !== isSave(b)) return isSave(a) ? -1 : 1
    if (a.node.hasOutgoingLinks !== b.node.hasOutgoingLinks) {
      return a.node.hasOutgoingLinks ? 1 : -1
    }
    return 0
  })

  return best
}

/**
 * Fallback when no known save/preview type matches: a terminal node the registry
 * marks as an output node. Widens sink detection to custom save nodes on
 * arbitrary share/`?template=` workflows, where the hardcoded type list misses.
 */
function findRegistrySink(
  graph: WorkflowGraph,
  nodeDefLookup: NodeDefLookup
): SinkMatch | null {
  const node = graph.nodes.find((n) => {
    if (n.hasOutgoingLinks) return false
    return nodeDefLookup(n.type)?.isOutputNode === true
  })
  if (!node) return null
  const producesVideo = nodeDefLookup(node.type)?.producesVideo === true
  return { node, mediaKind: producesVideo ? 'video' : 'image' }
}

function findSource(graph: WorkflowGraph): WorkflowGraphNode | null {
  return graph.nodes.find((n) => IMAGE_SOURCE_TYPES.has(n.type)) ?? null
}

function firstSampler(nodes: WorkflowGraphNode[]): WorkflowGraphNode | null {
  return nodes.find((n) => SAMPLER_TYPES.has(n.type)) ?? null
}

function subgraphHost(
  graph: WorkflowGraph
): { node: WorkflowGraphNode; subgraph: WorkflowSubgraph } | null {
  for (const node of graph.nodes) {
    if (!node.subgraphId) continue
    const subgraph = graph.subgraphs.find((s) => s.id === node.subgraphId)
    if (subgraph) return { node, subgraph }
  }
  return null
}

function promptPort(subgraph: WorkflowSubgraph): ExposedInput | null {
  const strings = subgraph.exposedInputs.filter((p) => p.type === 'STRING')
  const named = strings.find(
    (p) => PROMPT_PORT_NAMES.has(p.label ?? '') || PROMPT_PORT_NAMES.has(p.name)
  )
  return named ?? strings[0] ?? null
}

/** Inner node whose named widget-input is fed from the given boundary port. */
function boundaryFedNode(
  subgraph: WorkflowSubgraph,
  portSlot: number,
  widgetName: string
): WorkflowGraphNode | null {
  return (
    subgraph.nodes.find((node) =>
      node.inputs.some(
        (input) =>
          input.name === widgetName &&
          input.origin?.kind === 'boundary' &&
          input.origin.slot === portSlot
      )
    ) ?? null
  )
}

function resolveSubgraphPrompt(
  subgraphNodeId: NodeId,
  subgraph: WorkflowSubgraph
): PromptRole | null {
  const port = promptPort(subgraph)
  if (!port) return null

  const primitive = boundaryFedNode(subgraph, port.slot, 'value')
  if (primitive?.type === PROMPT_PRIMITIVE) {
    return {
      subgraphNodeId,
      innerNodeId: primitive.id,
      widgetName: 'value',
      portFallback: port.name
    }
  }

  const clip = boundaryFedNode(subgraph, port.slot, 'text')
  if (clip?.type === CLIP_TEXT_ENCODE) {
    return {
      subgraphNodeId,
      innerNodeId: clip.id,
      widgetName: 'text',
      portFallback: port.name
    }
  }

  return null
}

/**
 * The CLIPTextEncode feeding the first sampler's positive input, else the first
 * CLIPTextEncode anywhere (best-effort for graphs with no wired sampler).
 */
function positivePromptNode(graph: WorkflowGraph): WorkflowGraphNode | null {
  const sampler = firstSampler(graph.nodes)
  const positive = sampler?.inputs.find((i) => i.name === 'positive')
  if (positive?.origin?.kind === 'node') {
    const origin = positive.origin
    const feeder = graph.nodes.find((n) => n.id === origin.nodeId)
    if (feeder?.type === CLIP_TEXT_ENCODE) return feeder
  }
  return graph.nodes.find((n) => n.type === CLIP_TEXT_ENCODE) ?? null
}

function resolveTopLevelPrompt(graph: WorkflowGraph): PromptRole | null {
  const node = positivePromptNode(graph)
  if (!node) return null
  return {
    subgraphNodeId: node.id,
    innerNodeId: node.id,
    widgetName: 'text',
    portFallback: null
  }
}

function toNodeRole(nodeId: NodeId): NodeRole {
  return { nodeId }
}

/**
 * The pinned override for a curated template, if one exists. `Object.hasOwn`
 * guards against a `?template=` id like `"constructor"` matching a prototype
 * member and yielding a non-override value.
 */
function overrideFor(templateId: string | undefined): TemplateOverride | null {
  if (!templateId || !Object.hasOwn(templateOverrides, templateId)) return null
  return templateOverrides[templateId as CuratedTemplateId]
}

/**
 * The root-graph node to spotlight for a prompt whose editable widget lives on
 * `innerNodeId`: the node itself when it sits on the root graph, else the
 * collapsed host of the subgraph that contains it. Null when the id belongs to
 * no known node — the tour never enters a subgraph, so an inner id can't be a
 * spotlight target.
 */
function promptHostId(
  graph: WorkflowGraph,
  innerNodeId: NodeId
): NodeId | null {
  if (graph.nodes.some((n) => n.id === innerNodeId)) return innerNodeId
  for (const node of graph.nodes) {
    if (!node.subgraphId) continue
    const subgraph = graph.subgraphs.find((s) => s.id === node.subgraphId)
    if (subgraph?.nodes.some((n) => n.id === innerNodeId)) return node.id
  }
  return null
}

/**
 * Build the prompt role from the override's pinned inner node. `subgraphNodeId`
 * (the spotlight target) is resolved to a root-graph node so it never points at
 * a raw inner node; widget/port detail comes from the heuristic only when it
 * resolved the same inner node. Prompt degrades to null if the inner id is
 * unreachable.
 */
function overridePrompt(
  graph: WorkflowGraph,
  override: TemplateOverride,
  heuristicPrompt: PromptRole | null
): PromptRole | null {
  const subgraphNodeId = promptHostId(graph, override.promptNodeId)
  if (subgraphNodeId === null) return null

  const sameInner = heuristicPrompt?.innerNodeId === override.promptNodeId
  return {
    subgraphNodeId,
    innerNodeId: override.promptNodeId,
    widgetName: sameInner ? heuristicPrompt.widgetName : 'text',
    portFallback: sameInner ? heuristicPrompt.portFallback : null
  }
}

function applyOverride(
  graph: WorkflowGraph,
  override: TemplateOverride,
  heuristicPrompt: PromptRole | null
): ResolvedRoles {
  return {
    source: override.sourceNodeId ? toNodeRole(override.sourceNodeId) : null,
    prompt: overridePrompt(graph, override, heuristicPrompt),
    engine: toNodeRole(override.engineNodeId),
    sink: toNodeRole(override.sinkNodeId),
    mediaKind: override.mediaKind
  }
}

/**
 * Inspects a loaded workflow and returns the roles the tour targets. Works on
 * any graph — curated templates, arbitrary share/`?template=` workflows, and
 * custom user templates alike — via structural heuristics. Never throws; any
 * role that cannot be resolved is left null so the sequence builder degrades
 * gracefully. When `templateId` names a curated template, its pinned ids take
 * precedence over the heuristics.
 */
export function resolveRoles(
  workflow: ComfyWorkflowJSON,
  templateId?: string,
  nodeDefLookup: NodeDefLookup = () => null
): ResolvedRoles {
  const graph = fromWorkflowJson(workflow)
  const host = subgraphHost(graph)

  // Fall back to the root graph so an unrelated subgraph can't null out its roles.
  const subgraphPrompt = host
    ? resolveSubgraphPrompt(host.node.id, host.subgraph)
    : null
  const prompt = subgraphPrompt ?? resolveTopLevelPrompt(graph)

  const override = overrideFor(templateId)
  if (override) return applyOverride(graph, override, prompt)

  const sink = findSink(graph, nodeDefLookup)
  const source = findSource(graph)
  const engine =
    (host ? firstSampler(host.subgraph.nodes) : null) ??
    firstSampler(graph.nodes)

  return {
    source: source ? toNodeRole(source.id) : null,
    prompt,
    engine: engine ? toNodeRole(engine.id) : null,
    sink: sink ? toNodeRole(sink.node.id) : null,
    mediaKind: sink?.mediaKind ?? 'image'
  }
}

// --- Projection from serialized ComfyWorkflowJSON onto the resolver view. ---

interface RawNode {
  id: number | string
  type?: string
  inputs?: RawInput[]
  outputs?: { links?: number[] | null }[]
}

interface RawInput {
  name?: string
  link?: number | null
}

interface RawExposedInput {
  name?: string
  type?: string
  label?: string | null
}

interface RawSubgraph {
  id: string
  nodes?: RawNode[]
  links?: unknown
  inputs?: RawExposedInput[]
}

/**
 * The parts of a serialized workflow this resolver reads. `ComfyWorkflowJSON`'s
 * own type does not statically expose `definitions.subgraphs[].nodes/links`
 * (its recursive subgraph type omits them), so the projection asserts this
 * narrower view once at {@link fromWorkflowJson} and re-parses links loosely.
 */
interface RawWorkflow {
  nodes?: RawNode[]
  links?: unknown
  definitions?: { subgraphs?: RawSubgraph[] }
}

interface RawLink {
  id: number
  originId: NodeId
  originSlot: number
  targetId: NodeId
  targetSlot: number
}

const SUBGRAPH_INPUT_ORIGIN = '-10'

function readLink(raw: unknown): RawLink | null {
  if (Array.isArray(raw) && raw.length >= 6) {
    return {
      id: Number(raw[0]),
      originId: toNodeId(String(raw[1])),
      originSlot: Number(raw[2]),
      targetId: toNodeId(String(raw[3])),
      targetSlot: Number(raw[4])
    }
  }
  if (raw && typeof raw === 'object' && 'origin_id' in raw) {
    const linkObject = raw as Record<string, unknown>
    return {
      id: Number(linkObject.id),
      originId: toNodeId(String(linkObject.origin_id)),
      originSlot: Number(linkObject.origin_slot),
      targetId: toNodeId(String(linkObject.target_id)),
      targetSlot: Number(linkObject.target_slot)
    }
  }
  return null
}

function readLinks(raw: unknown): RawLink[] {
  if (!Array.isArray(raw)) return []
  return raw.map(readLink).filter((l): l is RawLink => l !== null)
}

function originFor(
  input: RawInput,
  links: RawLink[]
): WorkflowLinkOrigin | null {
  if (typeof input.link !== 'number') return null
  const link = links.find((l) => l.id === input.link)
  if (!link) return null
  if (String(link.originId) === SUBGRAPH_INPUT_ORIGIN) {
    return { kind: 'boundary', slot: link.originSlot }
  }
  return { kind: 'node', nodeId: link.originId, slot: link.originSlot }
}

function readNode(
  raw: RawNode,
  links: RawLink[],
  subgraphIds: Set<string>
): WorkflowGraphNode {
  const id = toNodeId(raw.id)
  const type = raw.type ?? ''
  return {
    id,
    type,
    subgraphId: subgraphIds.has(type) ? type : null,
    hasOutgoingLinks: (raw.outputs ?? []).some(
      (o) => (o.links?.length ?? 0) > 0
    ),
    inputs: (raw.inputs ?? []).map((input) => ({
      name: input.name ?? '',
      origin: originFor(input, links)
    }))
  }
}

/** Narrows the loosely-typed serialized workflow into the resolver's view. */
export function fromWorkflowJson(workflow: ComfyWorkflowJSON): WorkflowGraph {
  const raw: RawWorkflow = workflow

  const definitions = raw.definitions?.subgraphs ?? []
  const subgraphIds = new Set(definitions.map((d) => d.id))
  const topLinks = readLinks(raw.links)

  const subgraphs: WorkflowSubgraph[] = definitions.map((def) => {
    const innerLinks = readLinks(def.links)
    return {
      id: def.id,
      nodes: (def.nodes ?? []).map((n) => readNode(n, innerLinks, subgraphIds)),
      exposedInputs: (def.inputs ?? []).map((input, slot) => ({
        name: input.name ?? '',
        type: input.type ?? '',
        label: input.label ?? null,
        slot
      }))
    }
  })

  return {
    nodes: (raw.nodes ?? []).map((n) => readNode(n, topLinks, subgraphIds)),
    subgraphs
  }
}
