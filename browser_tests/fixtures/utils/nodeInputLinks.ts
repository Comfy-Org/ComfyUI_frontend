import { toNodeId } from '@/types/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

/** A connected input slot, paired with the node its link originates from. */
export interface ConnectedInput {
  name: string
  originNodeId: string
}

/** Names of a node's input slots starting with `namePrefix`, in slot order. */
export async function getInputNames(
  comfyPage: ComfyPage,
  nodeId: string,
  namePrefix: string
): Promise<string[]> {
  return comfyPage.page.evaluate(
    ({ nodeId, namePrefix }) => {
      const node = window.app!.canvas.graph!.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)

      return node.inputs
        .map((input) => input.name)
        .filter((name) => name.startsWith(namePrefix))
    },
    { nodeId: toNodeId(nodeId), namePrefix }
  )
}

/**
 * Connected input slots of a node whose name starts with `namePrefix`, in slot
 * order, paired with the node each link originates from.
 *
 * Reading the link graph directly is the only way to tell a rewired connection
 * from a dropped one: a slot that lost its link and a slot that never had one
 * render identically.
 */
export async function getConnectedInputs(
  comfyPage: ComfyPage,
  nodeId: string,
  namePrefix: string
): Promise<ConnectedInput[]> {
  return comfyPage.page.evaluate(
    ({ nodeId, namePrefix }) => {
      const graph = window.app!.canvas.graph!
      const node = graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)

      return node.inputs.flatMap((input, index) => {
        if (!input.name.startsWith(namePrefix)) return []
        const link = node.getInputLink(index)
        if (!link) return []
        return [{ name: input.name, originNodeId: String(link.origin_id) }]
      })
    },
    { nodeId: toNodeId(nodeId), namePrefix }
  )
}

export interface AutogrowInputGroup {
  /** Slot names in the group, in order, including the empty trailing slot. */
  slotNames: string[]
  /** Connected slots, in order, with the node each link originates from. */
  connections: ConnectedInput[]
  /**
   * Index of the empty trailing slot autogrow maintains, which is also the
   * count of connected slots.
   */
  trailingSlotIndex: number
}

/**
 * The current state of an autogrow input group, read from the graph.
 *
 * Exists so a test can describe what it is exercising - "fill the trailing
 * slot, expect one more" - instead of hard-coding the workflow fixture's
 * contents. A spec that restates those contents breaks the next time the
 * fixture gains a link, and the failure looks like a product regression rather
 * than a stale expectation. That is not hypothetical: it is how
 * `autogrowInputPersistence.spec.ts` came to assert two links against a fixture
 * that had grown to three.
 */
export async function readAutogrowInputGroup(
  comfyPage: ComfyPage,
  nodeId: string,
  namePrefix: string
): Promise<AutogrowInputGroup> {
  const [slotNames, connections] = await Promise.all([
    getInputNames(comfyPage, nodeId, namePrefix),
    getConnectedInputs(comfyPage, nodeId, namePrefix)
  ])
  return {
    slotNames,
    connections,
    trailingSlotIndex: connections.length
  }
}
