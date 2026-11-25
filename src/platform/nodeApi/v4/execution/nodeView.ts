import { once } from 'es-toolkit'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { containsCentre } from '@/lib/litegraph/src/measure'
import { inputLink } from '@/lib/litegraph/src/node/slotLinks'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { savedCopy, savedRecord } from '@/platform/nodeApi/shared/savedCopy'
import type { SavedCopier } from '@/platform/nodeApi/shared/savedCopy'
import { MODE_NAMES, boundsOnCanvas } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  GroupMembership,
  InputRef,
  OwnInput,
  OwnOutput,
  ResolvedNodeView
} from '@/platform/nodeApi/v4/types'

const NO_PROPERTIES: Readonly<Record<string, unknown>> = Object.freeze({})

/** Views of the nodes of one prompt build: one per node, read when first asked for. */
export interface NodeViews {
  viewOf(graph: LGraph, node: LGraphNode): ResolvedNodeView
  /** The nodes of `type` in `graph`, in the graph's order. */
  nodesOfType(graph: LGraph, type: unknown): readonly ResolvedNodeView[]
}

export function createNodeViews(copyOfSaved: SavedCopier): NodeViews {
  const views = new WeakMap<LGraphNode, ResolvedNodeView>()

  function viewOf(graph: LGraph, node: LGraphNode): ResolvedNodeView {
    const existing = views.get(node)
    if (existing) return existing
    const view = nodeView(graph, node, copyOfSaved)
    views.set(node, view)
    return view
  }

  return {
    viewOf,
    nodesOfType(graph, type) {
      if (typeof type !== 'string') {
        throw invalidArgument('nodesOfType', 'a type name', type)
      }
      return Object.freeze(
        graph.nodes
          .filter((node) => node.type === type)
          .map((node) => viewOf(graph, node))
      )
    }
  }
}

function inputRefOf(node: LGraphNode, ref: unknown): InputRef | undefined {
  const index = inputIndexOf(node, ref)
  return index === undefined
    ? undefined
    : Object.freeze({ nodeId: String(node.id), input: index })
}

function inputIndexOf(node: LGraphNode, ref: unknown): number | undefined {
  if (typeof ref === 'string') {
    const index = node.inputs.findIndex((input) => input.name === ref)
    return index === -1 ? undefined : index
  }
  if (typeof ref !== 'number' || !Number.isInteger(ref)) {
    throw invalidArgument('input', 'an input index or name', ref)
  }
  return ref >= 0 && ref < node.inputs.length ? ref : undefined
}

function nodeView(
  graph: LGraph,
  node: LGraphNode,
  copyOfSaved: SavedCopier
): ResolvedNodeView {
  const properties = once(
    () => savedRecord(savedCopy(node.properties)) ?? NO_PROPERTIES
  )
  const groups = once(() => groupsHolding(graph, node))
  const inputs = once(() => ownInputs(graph, node))
  const outputs = once(() => ownOutputs(node))

  return Object.freeze({
    id: String(node.id),
    type: node.type,
    mode: MODE_NAMES.get(node.mode),
    color: typeof node.color === 'string' ? node.color : undefined,
    get properties() {
      return properties()
    },
    get groups() {
      return groups()
    },
    get inputs() {
      return inputs()
    },
    get outputs() {
      return outputs()
    },
    widgetValue(name: string) {
      if (typeof name !== 'string') {
        throw invalidArgument('widgetValue', 'a widget name', name)
      }
      const widget = node.widgets?.find((candidate) => candidate.name === name)
      return widget && copyOfSaved('widgetValue', widget.value)
    },
    input: (ref: string | number) => inputRefOf(node, ref)
  })
}

function groupsHolding(
  graph: LGraph,
  node: LGraphNode
): readonly GroupMembership[] {
  const { x, y, width, height } = boundsOnCanvas(node)
  return Object.freeze(
    graph.groups
      .filter((group) =>
        containsCentre(group.boundingRect, [x, y, width, height])
      )
      .map((group) =>
        Object.freeze({ id: String(group.id), title: group.title })
      )
  )
}

/** The name the editor shows for a slot. */
export function shownName(slot: {
  readonly name: string
  readonly label?: string
  readonly localized_name?: string
}): string {
  return slot.label || slot.localized_name || slot.name
}

function ownInputs(graph: LGraph, node: LGraphNode): readonly OwnInput[] {
  return Object.freeze(
    node.inputs.map((input, index) => {
      const link = inputLink(graph, node.id, index)
      return Object.freeze({
        index,
        name: input.name,
        label: shownName(input),
        connectedType: link && String(link.type),
        sourceNodeId: link && String(link.origin_id)
      })
    })
  )
}

function ownOutputs(node: LGraphNode): readonly OwnOutput[] {
  return Object.freeze(
    node.outputs.map((output, index) =>
      Object.freeze({
        index,
        name: output.name,
        label: shownName(output),
        type: String(output.type)
      })
    )
  )
}
