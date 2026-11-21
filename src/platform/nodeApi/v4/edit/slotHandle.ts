import { toNodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { inputLink, outputLinks } from '@/lib/litegraph/src/node/slotLinks'

import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  InputSlotHandle,
  InputSlotPatch,
  OutputSlotHandle,
  SlotPatch,
  SlotRef
} from '@/platform/nodeApi/v4/types'
import { checkedString } from './checkedArguments'
import type { EditCore } from './edits'
import { linkInfoOf } from './linkInfo'
import type { LiveSlot, SlotHandles } from './liveSlot'
import { checkedSlotRef, slotIndexOf } from './slotRef'
import { isSlotConnected, slotSnapshotOf, slotTypeOf } from './slotSnapshot'

/** What a slot handle needs: its slot, the edit core and the handles beside it. */
export interface SlotHandleContext {
  readonly edits: () => EditCore
  readonly nodes: NodeHandles
  readonly slots: SlotHandles
  locate(): LiveSlot | undefined
}

export function inputSlotHandle(
  id: string,
  { edits, locate }: SlotHandleContext
): InputSlotHandle {
  const read = reader(locate)
  const link = (live: LiveSlot) =>
    inputLink(live.graph, live.node.id, live.index)

  const handle: InputSlotHandle = Object.freeze({
    id,
    get isDeleted() {
      return !locate()
    },
    get index() {
      return read(({ index }) => index)
    },
    get name() {
      return read(({ slot }) => slot.name)
    },
    get type() {
      return read(({ slot }) => slotTypeOf(slot))
    },
    get label() {
      return read(({ slot }) => slot.label)
    },
    get isConnected() {
      return read(isSlotConnected)
    },
    get isWidgetInput() {
      return read(({ slot }) => slot.widget !== undefined)
    },
    get connectedType() {
      return read((live) => typeOfLink(link(live)))
    },
    link: () => read((live) => linkInfoIn(live.graph, link(live))),
    source: () => read((live) => sourceOf(link(live))),
    snapshot: () => read(slotSnapshotOf),
    modify: (patch: InputSlotPatch) =>
      edits().updateSlot(handle, patch, 'modify'),
    disconnect: () => edits().disconnect(handle)
  })
  return handle
}

export function outputSlotHandle(
  id: string,
  { edits, nodes, slots, locate }: SlotHandleContext
): OutputSlotHandle {
  const read = reader(locate)
  const links = (live: LiveSlot) =>
    outputLinks(live.graph, live.node.id, live.index)

  const handle: OutputSlotHandle = Object.freeze({
    id,
    get isDeleted() {
      return !locate()
    },
    get index() {
      return read(({ index }) => index)
    },
    get name() {
      return read(({ slot }) => slot.name)
    },
    get type() {
      return read(({ slot }) => slotTypeOf(slot))
    },
    get label() {
      return read(({ slot }) => slot.label)
    },
    get isConnected() {
      return read(isSlotConnected)
    },
    links: () =>
      read((live) =>
        Object.freeze(links(live).map((link) => linkInfoOf(live.graph, link)))
      ),
    targets: () => read((live) => Object.freeze(links(live).map(targetOf))),
    snapshot: () => read(slotSnapshotOf),
    modify: (patch: SlotPatch) => edits().updateSlot(handle, patch, 'modify'),

    connectTo(targetNodeId: string, input: SlotRef) {
      const nodeId = checkedString(
        'connectTo',
        'a target node id',
        targetNodeId
      )
      const ref = checkedSlotRef('connectTo', input)
      const live = locate()
      const target = live?.graph.getNodeById(toNodeId(nodeId))
      if (!live || !target) return undefined
      const index = slotIndexOf('connectTo', target.inputs, ref)
      if (index === -1) return undefined
      const inputHandle = slots.inputHandle(
        live.graph,
        target,
        target.inputs[index]
      )
      return edits().connect(handle, inputHandle)
    },

    disconnect(targetNodeId?: string) {
      if (targetNodeId === undefined) return edits().disconnect(handle)
      const nodeId = checkedString(
        'disconnect',
        'a target node id',
        targetNodeId
      )
      const live = locate()
      const target = live && nodes.find(live.graph, nodeId)
      return target !== undefined && edits().disconnect(handle, target)
    },

    moveLinksTo(target: SlotRef) {
      const ref = checkedSlotRef('moveLinksTo', target)
      const live = locate()
      if (!live) return undefined
      const { outputs } = live.node
      const index = slotIndexOf('moveLinksTo', outputs, ref)
      if (index === -1) return undefined
      const targetHandle = slots.outputHandle(
        live.graph,
        live.node,
        outputs[index]
      )
      return edits().moveLinks(handle, targetHandle)
    }
  })
  return handle
}

function reader(locate: () => LiveSlot | undefined) {
  return <T>(read: (live: LiveSlot) => T): T | undefined => {
    const live = locate()
    return live ? read(live) : undefined
  }
}

function typeOfLink(link: LLink | undefined): string | undefined {
  return link && String(link.type)
}

function linkInfoIn(graph: LGraph, link: LLink | undefined) {
  return link && linkInfoOf(graph, link)
}

function sourceOf(link: LLink | undefined) {
  return (
    link &&
    Object.freeze({
      nodeId: String(link.origin_id),
      outputIndex: link.origin_slot
    })
  )
}

function targetOf(link: LLink) {
  return Object.freeze({
    nodeId: String(link.target_id),
    inputIndex: link.target_slot
  })
}
