import type { SubgraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'

import {
  captureInputLayout,
  outputLinks,
  replaceNodeInputs,
  updateLinkEndpoints
} from '#/node/slotLinks'

import { hostInputOf } from './hostInput'

function inputsInSubgraphOrder(
  host: SubgraphNode
): INodeInputSlot[] | undefined {
  const owners = host.subgraph.inputs.map((input) => hostInputOf(host, input))
  if (!owners.every((owner): owner is INodeInputSlot => !!owner))
    return undefined
  const ordered = owners.flatMap((owner) => [
    owner,
    ...host.inputs.filter(
      (input) =>
        !owners.includes(input) && input.name.startsWith(`${owner.name}.`)
    )
  ])
  return ordered.length === host.inputs.length ? ordered : undefined
}

/**
 * Moves the host's inputs, with their links, into its subgraph's input order.
 * @returns whether the host's inputs moved.
 */
export function followSubgraphInputOrder(host: SubgraphNode): boolean {
  const ordered = inputsInSubgraphOrder(host)
  if (!ordered) {
    console.error('followSubgraphInputOrder: host inputs differ', {
      hostInputs: host.inputs.length,
      subgraphInputs: host.subgraph.inputs.length
    })
    return false
  }
  if (ordered.every((input, slot) => input === host.inputs[slot])) return false

  return replaceNodeInputs(host, captureInputLayout(host), ordered).ok
}

/** Moves the host's outputs, with their links, from `oldOrder` to `newOrder`. */
export function followSubgraphOutputOrder(
  host: SubgraphNode,
  oldOrder: readonly string[],
  newOrder: readonly string[]
): void {
  if (host.outputs.length !== oldOrder.length) {
    console.error('followSubgraphOutputOrder: host outputs differ', {
      hostOutputs: host.outputs.length,
      subgraphOutputs: oldOrder.length
    })
    return
  }
  const sources = newOrder.map((id) => oldOrder.indexOf(id))
  const { graph } = host
  if (graph) {
    const updates = sources.flatMap((oldSlot, slot) =>
      outputLinks(graph, host.id, oldSlot).map((link) => ({
        link,
        patch: { originSlot: slot }
      }))
    )
    if (!updateLinkEndpoints(graph, updates)) return
  }
  host.outputs = sources.map((slot) => host.outputs[slot])
}
