import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'

import { outputLinks } from '@/lib/litegraph/src/node/slotLinks'
import { useLinkStore } from '@/stores/linkStore'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { LiveNode, NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { LinkInfo, SlotSide } from '@/platform/nodeApi/v4/types'
import type { EditRunner } from './editRunner'
import { linkInfoOf } from './linkInfo'
import type { LiveSlot, SlotHandles } from './liveSlot'
import { liveNodeOf } from './nodeEdits'
import { isShared } from './sharedDocument'
import { slotLocatorOf } from './slotEdits'
import { isSlotConnected } from './slotSnapshot'

/** The link edits, taking anything a pack passes and checking it. */
export interface LinkEdits {
  connect(output: unknown, input: unknown): LinkInfo | undefined
  disconnect(slot: unknown, target?: unknown): boolean
  moveLinks(from: unknown, to: unknown): readonly LinkInfo[] | undefined
}

export function createLinkEdits(
  nodes: NodeHandles,
  slots: SlotHandles,
  runner: EditRunner
): LinkEdits {
  function slotOn(member: string, side: SlotSide, handle: unknown) {
    const locator = slotLocatorOf(slots, member, handle)
    if (locator.side !== side) {
      throw invalidArgument(member, `an ${side} slot handle`, handle)
    }
    return locator.locate()
  }

  function disconnectTarget(
    side: SlotSide,
    target: unknown
  ): LiveNode | null | undefined {
    if (target === undefined) return undefined
    if (side === 'input') {
      throw invalidArgument('disconnect', 'no target for an input', target)
    }
    return liveNodeOf(nodes, 'disconnect', target) ?? null
  }

  return {
    connect(output, input) {
      const from = slotOn('connect', 'output', output)
      const to = slotOn('connect', 'input', input)
      if (!from || !to) return undefined
      assertOneGraph('connect', from, to)
      const link = runner.apply(from.graph, () =>
        from.node.connect(from.index, to.node, to.index)
      )
      return link ? linkInfoOf(from.graph, link) : undefined
    },

    disconnect(slot, target) {
      const locator = slotLocatorOf(slots, 'disconnect', slot)
      const targetNode = disconnectTarget(locator.side, target)
      const live = locator.locate()
      if (!live || targetNode === null) return false
      if (targetNode && targetNode.graph !== live.graph) {
        throw invalidArgument(
          'disconnect',
          'a target in the slot’s graph',
          target
        )
      }
      if (!isSlotConnected(live)) return false
      return runner.apply(live.graph, () =>
        live.side === 'input'
          ? live.node.disconnectInput(live.index)
          : live.node.disconnectOutput(live.index, targetNode?.node)
      )
    },

    moveLinks(from, to) {
      const source = slotOn('moveLinks', 'output', from)
      const destination = slotOn('moveLinks', 'output', to)
      if (!source || !destination) return undefined
      if (source.node !== destination.node) {
        throw invalidArgument('moveLinks', 'two outputs of one node', to)
      }
      if (isShared(source.graph)) return undefined
      return runner.apply(source.graph, () =>
        moveOutputLinks(source, destination)
      )
    }
  }
}

function assertOneGraph(member: string, a: LiveSlot, b: LiveSlot): void {
  if (a.graph !== b.graph) {
    throw invalidArgument(member, 'two slots in one graph', b.graph.id)
  }
}

function moveOutputLinks(
  source: LiveSlot,
  destination: LiveSlot
): readonly LinkInfo[] | undefined {
  const { graph, node } = source
  const links = outputLinks(graph, node.id, source.index)
  const result = useLinkStore().updateEndpoints(
    graphScopeOf(graph),
    links.map((link) => ({
      topology: link._state,
      patch: { originSlot: destination.index }
    }))
  )
  return result.ok
    ? Object.freeze(links.map((link) => linkInfoOf(graph, link)))
    : undefined
}
