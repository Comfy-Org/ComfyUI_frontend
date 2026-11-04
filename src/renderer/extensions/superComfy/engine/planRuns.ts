import type {
  ExecutableNode,
  MediaItem,
  NodeId,
  PortSpec,
  RunKey,
  SuperEdge,
  SuperGraphDocument
} from './documentSchema'
import { findNode, incomingEdges, portsOf } from './graphTopology'
import { itemKey, textItem } from './items'
import { stableKey } from './stableKey'
import type { Block, PlanOptions, PlannedRun, RunPlan } from './types'

interface Contribution {
  items: MediaItem[]
}

interface GatheredPort {
  port: PortSpec
  contributions: Contribution[]
}

export function sourceItems(
  doc: SuperGraphDocument,
  edge: SuperEdge,
  exclude?: ReadonlySet<NodeId>
): MediaItem[] {
  const source = findNode(doc, edge.from.node)
  if (!source || exclude?.has(source.id)) return []
  if (source.kind === 'io') return source.items
  return source.result?.outputs[edge.from.port] ?? []
}

function inlineText(node: ExecutableNode, port: PortSpec): string {
  if (!port.inline || !Object.hasOwn(node.inline, port.name)) return ''
  return node.inline[port.name]
}

function contributionsFor(
  doc: SuperGraphDocument,
  node: ExecutableNode,
  port: PortSpec,
  exclude?: ReadonlySet<NodeId>
): Contribution[] {
  const edges = incomingEdges(doc, node.id, port.name)
  if (edges.length > 0) {
    return edges
      .map((edge) => ({ items: sourceItems(doc, edge, exclude) }))
      .filter((contribution) => contribution.items.length > 0)
  }
  const text = inlineText(node, port)
  return text.trim() === '' ? [] : [{ items: [textItem(text)] }]
}

export function portHasContent(
  doc: SuperGraphDocument,
  nodeId: NodeId,
  port: string
): boolean {
  const node = findNode(doc, nodeId)
  if (!node) return false
  if (node.kind === 'io') {
    return incomingEdges(doc, nodeId, port).some(
      (edge) => sourceItems(doc, edge).length > 0
    )
  }
  const spec = portsOf(node).inputs.find((input) => input.name === port)
  return spec !== undefined && contributionsFor(doc, node, spec).length > 0
}

function configFingerprint(node: ExecutableNode): string {
  const identity =
    node.kind === 'generate'
      ? { kind: node.kind, modality: node.modality, modelId: node.modelId }
      : { kind: node.kind, workflowPath: node.workflowPath }
  const values = Object.fromEntries(
    Object.entries(node.values).filter(([, value]) => value !== '')
  )
  return stableKey({
    ...identity,
    contractVersion: node.contract?.version ?? null,
    values
  })
}

function runKey(
  config: string,
  inputs: Record<string, MediaItem[]>,
  repeat: number
): RunKey {
  const identities = Object.fromEntries(
    Object.entries(inputs).map(([port, items]) => [port, items.map(itemKey)])
  )
  return stableKey([config, identities, repeat])
}

export function samePlanKeys(
  a: readonly RunKey[],
  b: readonly RunKey[]
): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}

function maxItems(port: PortSpec): number {
  if (!port.multi) return 1
  return port.max ?? Number.POSITIVE_INFINITY
}

function findBlock(
  gathered: GatheredPort[],
  total: number,
  runLimit: number
): Block | null {
  const missing = gathered
    .filter(({ port, contributions }) => port.required && !contributions.length)
    .map(({ port }) => port.name)
  if (missing.length > 0) return { reason: 'missingInputs', ports: missing }
  if (total > runLimit) {
    return { reason: 'tooManyRuns', runs: total, limit: runLimit }
  }
  const overfull = gathered.find(
    ({ port, contributions }) => contributions.length > maxItems(port)
  )
  if (overfull) {
    return {
      reason: 'tooManyItems',
      port: overfull.port.name,
      count: overfull.contributions.length,
      max: maxItems(overfull.port)
    }
  }
  return null
}

function productOf(dimensions: readonly Contribution[]): number {
  return dimensions.reduce((product, { items }) => product * items.length, 1)
}

function choicesFor(
  dimensions: readonly Contribution[],
  combo: number
): Map<Contribution, number> {
  return new Map(
    dimensions.map((dimension, position) => [
      dimension,
      Math.floor(combo / productOf(dimensions.slice(position + 1))) %
        dimension.items.length
    ])
  )
}

function inputsFor(
  gathered: GatheredPort[],
  choices: ReadonlyMap<Contribution, number>
): Record<string, MediaItem[]> {
  return Object.fromEntries(
    gathered
      .filter(({ contributions }) => contributions.length > 0)
      .map(({ port, contributions }) => [
        port.name,
        contributions.map(
          (contribution) => contribution.items[choices.get(contribution) ?? 0]
        )
      ])
  )
}

function duplicateOrdinals(): (inputs: Record<string, MediaItem[]>) => number {
  const seen = new Map<string, number>()
  return (inputs) => {
    const identity = runKey('', inputs, 0)
    const ordinal = seen.get(identity) ?? 0
    seen.set(identity, ordinal + 1)
    return ordinal
  }
}

function withOrdinal(key: RunKey, ordinal: number): RunKey {
  return ordinal === 0 ? key : stableKey([key, ordinal])
}

export function planRuns(
  doc: SuperGraphDocument,
  nodeId: NodeId,
  opts: PlanOptions
): RunPlan {
  const node = findNode(doc, nodeId)
  if (!node || node.kind === 'io' || !node.contract) {
    return { ok: false, block: { reason: 'noContract' } }
  }
  const ports: PortSpec[] = node.contract.inputs
  const gathered = ports.map((port) => ({
    port,
    contributions: contributionsFor(doc, node, port, opts.exclude)
  }))
  const dimensions = gathered.flatMap(({ contributions }) =>
    contributions.filter(({ items }) => items.length > 1)
  )
  const combos = productOf(dimensions)
  const runCount = Math.max(1, Math.floor(node.runCount))
  const block = findBlock(gathered, combos * runCount, opts.runLimit)
  if (block) return { ok: false, block }

  const config = configFingerprint(node)
  const ordinalOf = duplicateOrdinals()
  const combinations = Array.from({ length: combos }, (_, combo) => {
    const inputs = inputsFor(gathered, choicesFor(dimensions, combo))
    return { inputs, ordinal: ordinalOf(inputs) }
  })
  const runs = combinations.flatMap(({ inputs, ordinal }, combo) =>
    Array.from({ length: runCount }, (_, repeat): PlannedRun => ({
      index: combo * runCount + repeat,
      repeat,
      key: withOrdinal(runKey(config, inputs, repeat), ordinal),
      inputs
    }))
  )
  return { ok: true, runs }
}
