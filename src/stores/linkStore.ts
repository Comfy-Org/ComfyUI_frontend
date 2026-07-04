import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import { UNASSIGNED_NODE_ID } from '@/types/nodeId'

import type { LinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

export type EndpointPatch = Partial<
  Pick<
    LinkTopology,
    'originNodeId' | 'originSlot' | 'targetNodeId' | 'targetSlot'
  >
>

type GraphLinkIndex = Map<UUID, Map<LinkId, LinkTopology>>
type TargetSlotIndex = Map<UUID, Map<NodeId, Map<number, LinkId>>>

export const useLinkStore = defineStore('link', () => {
  const graphLinks = ref<GraphLinkIndex>(new Map())
  const targetSlotIndex = ref<TargetSlotIndex>(new Map())

  function getGraphLinks(graphId: UUID): Map<LinkId, LinkTopology> {
    const existing = graphLinks.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<LinkId, LinkTopology>())
    graphLinks.value.set(graphId, next)
    return next
  }

  function getGraphTargetSlots(
    graphId: UUID
  ): Map<NodeId, Map<number, LinkId>> {
    const existing = targetSlotIndex.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<NodeId, Map<number, LinkId>>())
    targetSlotIndex.value.set(graphId, next)
    return next
  }

  function nodeTargetSlots(graphId: UUID, nodeId: NodeId): Map<number, LinkId> {
    const nodeMap = getGraphTargetSlots(graphId)
    const existing = nodeMap.get(nodeId)
    if (existing) return existing
    const next = reactive(new Map<number, LinkId>())
    nodeMap.set(nodeId, next)
    return next
  }

  function indexLink(graphId: UUID, topology: LinkTopology): void {
    if (topology.targetNodeId === UNASSIGNED_NODE_ID) return
    nodeTargetSlots(graphId, topology.targetNodeId).set(
      topology.targetSlot,
      topology.id
    )
  }

  function unindexLink(graphId: UUID, topology: LinkTopology): void {
    if (topology.targetNodeId === UNASSIGNED_NODE_ID) return
    const targets = targetSlotIndex.value
      .get(graphId)
      ?.get(topology.targetNodeId)
    if (targets?.get(topology.targetSlot) === topology.id) {
      targets.delete(topology.targetSlot)
    }
  }

  /**
   * Registers a link's topology and (re)asserts its target-slot index. On an id
   * collision with a different object the newest object wins, so the store never
   * diverges from the graph's link map; re-registering the same object re-claims
   * the slot index (used to restore the survivor after duplicate purging).
   */
  function registerLink(graphId: UUID, topology: LinkTopology): LinkTopology {
    const links = getGraphLinks(graphId)
    const existing = links.get(topology.id)
    if (existing && existing !== topology) unindexLink(graphId, existing)
    links.set(topology.id, topology)
    indexLink(graphId, topology)
    return topology
  }

  function getLink(graphId: UUID, linkId: LinkId): LinkTopology | undefined {
    return getGraphLinks(graphId).get(linkId)
  }

  function updateEndpoint(
    graphId: UUID,
    linkId: LinkId,
    patch: EndpointPatch
  ): void {
    const topology = getGraphLinks(graphId).get(linkId)
    if (!topology) return
    unindexLink(graphId, topology)
    if (patch.originNodeId !== undefined) {
      topology.originNodeId = patch.originNodeId
    }
    if (patch.originSlot !== undefined) topology.originSlot = patch.originSlot
    if (patch.targetNodeId !== undefined) {
      topology.targetNodeId = patch.targetNodeId
    }
    if (patch.targetSlot !== undefined) topology.targetSlot = patch.targetSlot
    indexLink(graphId, topology)
  }

  function deleteLink(graphId: UUID, linkId: LinkId): boolean {
    const links = getGraphLinks(graphId)
    const topology = links.get(linkId)
    if (!topology) return false
    unindexLink(graphId, topology)
    return links.delete(linkId)
  }

  function isInputSlotConnected(
    graphId: UUID,
    nodeId: NodeId,
    slot: number
  ): boolean {
    return nodeTargetSlots(graphId, nodeId).has(slot)
  }

  function getInputSlotLink(
    graphId: UUID,
    nodeId: NodeId,
    slot: number
  ): LinkTopology | undefined {
    const linkId = nodeTargetSlots(graphId, nodeId).get(slot)
    return linkId === undefined ? undefined : getLink(graphId, linkId)
  }

  function clearGraph(graphId: UUID): void {
    graphLinks.value.delete(graphId)
    targetSlotIndex.value.delete(graphId)
  }

  return {
    registerLink,
    getLink,
    updateEndpoint,
    deleteLink,
    isInputSlotConnected,
    getInputSlotLink,
    clearGraph
  }
})
