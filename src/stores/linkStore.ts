import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { LinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

type EndpointPatch = Partial<
  Pick<
    LinkTopology,
    'originNodeId' | 'originSlot' | 'targetNodeId' | 'targetSlot'
  >
>

export const useLinkStore = defineStore('link', () => {
  const graphLinks = ref(new Map<UUID, Map<LinkId, LinkTopology>>())
  const targetSlotIndex = ref(new Map<UUID, Map<NodeId, Map<number, LinkId>>>())
  const originSlotIndex = ref(
    new Map<UUID, Map<NodeId, Map<number, Set<LinkId>>>>()
  )

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

  function getGraphOriginSlots(
    graphId: UUID
  ): Map<NodeId, Map<number, Set<LinkId>>> {
    const existing = originSlotIndex.value.get(graphId)
    if (existing) return existing
    const next = reactive(new Map<NodeId, Map<number, Set<LinkId>>>())
    originSlotIndex.value.set(graphId, next)
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

  function nodeOriginSlots(
    graphId: UUID,
    nodeId: NodeId
  ): Map<number, Set<LinkId>> {
    const nodeMap = getGraphOriginSlots(graphId)
    const existing = nodeMap.get(nodeId)
    if (existing) return existing
    const next = reactive(new Map<number, Set<LinkId>>())
    nodeMap.set(nodeId, next)
    return next
  }

  function indexLink(graphId: UUID, topology: LinkTopology): void {
    nodeTargetSlots(graphId, topology.targetNodeId).set(
      topology.targetSlot,
      topology.id
    )
    const originSlots = nodeOriginSlots(graphId, topology.originNodeId)
    const set =
      originSlots.get(topology.originSlot) ?? reactive(new Set<LinkId>())
    set.add(topology.id)
    originSlots.set(topology.originSlot, set)
  }

  function unindexLink(graphId: UUID, topology: LinkTopology): void {
    const targets = targetSlotIndex.value
      .get(graphId)
      ?.get(topology.targetNodeId)
    if (targets?.get(topology.targetSlot) === topology.id) {
      targets.delete(topology.targetSlot)
    }
    const originSet = originSlotIndex.value
      .get(graphId)
      ?.get(topology.originNodeId)
      ?.get(topology.originSlot)
    originSet?.delete(topology.id)
  }

  function registerLink(graphId: UUID, topology: LinkTopology): LinkTopology {
    const links = getGraphLinks(graphId)
    const existing = links.get(topology.id)
    if (existing) return existing
    links.set(topology.id, topology)
    indexLink(graphId, topology)
    return links.get(topology.id) as LinkTopology
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

  function getOutputSlotLinks(
    graphId: UUID,
    nodeId: NodeId,
    slot: number
  ): LinkTopology[] {
    const ids = nodeOriginSlots(graphId, nodeId).get(slot)
    if (!ids) return []
    return [...ids].flatMap((id) => {
      const topology = getLink(graphId, id)
      return topology ? [topology] : []
    })
  }

  function getNodeLinks(graphId: UUID, nodeId: NodeId): LinkTopology[] {
    const ids = new Set<LinkId>()
    for (const id of nodeTargetSlots(graphId, nodeId).values()) ids.add(id)
    for (const set of nodeOriginSlots(graphId, nodeId).values()) {
      for (const id of set) ids.add(id)
    }
    return [...ids].flatMap((id) => {
      const topology = getLink(graphId, id)
      return topology ? [topology] : []
    })
  }

  function clearGraph(graphId: UUID): void {
    graphLinks.value.delete(graphId)
    targetSlotIndex.value.delete(graphId)
    originSlotIndex.value.delete(graphId)
  }

  return {
    registerLink,
    getLink,
    updateEndpoint,
    deleteLink,
    isInputSlotConnected,
    getInputSlotLink,
    getOutputSlotLinks,
    getNodeLinks,
    clearGraph
  }
})
