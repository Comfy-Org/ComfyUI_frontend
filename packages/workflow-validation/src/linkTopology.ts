export type WorkflowLinkTuple = readonly [
  id: number,
  originId: string | number,
  originSlot: number,
  targetId: string | number,
  targetSlot: number,
  type?: unknown
]

export interface WorkflowLinkObject {
  id: number
  origin_id: string | number
  origin_slot: number
  target_id: string | number
  target_slot: number
}

export type WorkflowLink = WorkflowLinkTuple | WorkflowLinkObject

export interface WorkflowNode {
  id: string | number
  inputs?: readonly { link?: number | null }[]
  outputs?: readonly { links?: readonly number[] | null }[]
}

export interface WorkflowGraph {
  id?: string
  name?: string
  nodes?: readonly WorkflowNode[]
  links?: readonly (WorkflowLink | null)[]
  definitions?: {
    subgraphs?: readonly WorkflowGraph[]
  }
}

export interface LinkContext {
  graphPath: readonly string[]
  linkId: number
  originId: string | number
  originSlot: number
  targetId: string | number
  targetSlot: number
}

export type TopologyError =
  | { kind: 'missing-origin-node'; link: LinkContext }
  | { kind: 'missing-target-node'; link: LinkContext }
  | { kind: 'origin-slot-out-of-bounds'; link: LinkContext; slotCount: number }
  | { kind: 'target-slot-out-of-bounds'; link: LinkContext; slotCount: number }
  | { kind: 'origin-link-not-listed'; link: LinkContext }
  | {
      kind: 'target-link-mismatch'
      link: LinkContext
      actualLink: number | null
    }

function graphLabel(graph: WorkflowGraph, index: number): string {
  return graph.name ?? graph.id ?? `subgraph[${index}]`
}

function toLinkContext(
  link: WorkflowLink,
  graphPath: readonly string[]
): LinkContext {
  if (isLinkTuple(link)) {
    return {
      graphPath,
      linkId: link[0],
      originId: link[1],
      originSlot: link[2],
      targetId: link[3],
      targetSlot: link[4]
    }
  }
  return {
    graphPath,
    linkId: link.id,
    originId: link.origin_id,
    originSlot: link.origin_slot,
    targetId: link.target_id,
    targetSlot: link.target_slot
  }
}

function isLinkTuple(link: WorkflowLink): link is WorkflowLinkTuple {
  return Array.isArray(link)
}

function validateGraph(
  graph: WorkflowGraph,
  graphPath: readonly string[],
  errors: TopologyError[]
): void {
  const nodes = graph.nodes ?? []
  const nodesById = new Map(nodes.map((node) => [String(node.id), node]))

  for (const candidate of graph.links ?? []) {
    if (!candidate) continue
    validateLink(candidate, graphPath, nodesById, errors)
  }

  for (const [index, subgraph] of (
    graph.definitions?.subgraphs ?? []
  ).entries()) {
    validateGraph(subgraph, [...graphPath, graphLabel(subgraph, index)], errors)
  }
}

function validateLink(
  candidate: WorkflowLink,
  graphPath: readonly string[],
  nodesById: ReadonlyMap<string, WorkflowNode>,
  errors: TopologyError[]
): void {
  const link = toLinkContext(candidate, graphPath)
  const origin = nodesById.get(String(link.originId))
  const target = nodesById.get(String(link.targetId))

  if (!origin) errors.push({ kind: 'missing-origin-node', link })
  if (!target) errors.push({ kind: 'missing-target-node', link })
  if (!origin || !target) return

  validateConnectedLink(link, origin, target, errors)
}

function validateConnectedLink(
  link: LinkContext,
  origin: WorkflowNode,
  target: WorkflowNode,
  errors: TopologyError[]
): void {
  const outputs = origin.outputs ?? []
  const inputs = target.inputs ?? []
  if (!validateSlotBounds(link, outputs.length, inputs.length, errors)) return

  validateSlotMembership(link, outputs, inputs, errors)
}

function validateSlotBounds(
  link: LinkContext,
  outputCount: number,
  inputCount: number,
  errors: TopologyError[]
): boolean {
  const originOutOfBounds =
    link.originSlot < 0 || link.originSlot >= outputCount
  const targetOutOfBounds = link.targetSlot < 0 || link.targetSlot >= inputCount

  if (originOutOfBounds) {
    errors.push({
      kind: 'origin-slot-out-of-bounds',
      link,
      slotCount: outputCount
    })
  }
  if (targetOutOfBounds) {
    errors.push({
      kind: 'target-slot-out-of-bounds',
      link,
      slotCount: inputCount
    })
  }
  return !originOutOfBounds && !targetOutOfBounds
}

function validateSlotMembership(
  link: LinkContext,
  outputs: NonNullable<WorkflowNode['outputs']>,
  inputs: NonNullable<WorkflowNode['inputs']>,
  errors: TopologyError[]
): void {
  if (!(outputs[link.originSlot]?.links ?? []).includes(link.linkId)) {
    errors.push({ kind: 'origin-link-not-listed', link })
  }
  const actualLink = inputs[link.targetSlot]?.link ?? null
  if (actualLink !== link.linkId) {
    errors.push({ kind: 'target-link-mismatch', link, actualLink })
  }
}

/** Validates link topology without mutating the workflow or attempting repair. */
export function validateLinkTopology(graph: WorkflowGraph): TopologyError[] {
  const errors: TopologyError[] = []
  validateGraph(graph, ['root'], errors)
  return errors
}

export function describeTopologyError(error: TopologyError): string {
  const { graphPath, linkId, originId, originSlot, targetId, targetSlot } =
    error.link
  const prefix = `${graphPath.join(' > ')}: link ${linkId} (${originId}:${originSlot} -> ${targetId}:${targetSlot})`
  switch (error.kind) {
    case 'missing-origin-node':
      return `${prefix} references a missing origin node`
    case 'missing-target-node':
      return `${prefix} references a missing target node`
    case 'origin-slot-out-of-bounds':
      return `${prefix} uses an origin slot outside ${error.slotCount} output(s)`
    case 'target-slot-out-of-bounds':
      return `${prefix} uses a target slot outside ${error.slotCount} input(s)`
    case 'origin-link-not-listed':
      return `${prefix} is absent from the origin output`
    case 'target-link-mismatch':
      return `${prefix} does not match target input link ${error.actualLink}`
  }
}
