import { computed } from 'vue'
import type { Ref } from 'vue'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { isGroupNode } from '@/utils/executableGroupNodeDto'
import { st } from '@/i18n'
import type { ErrorCardData, ErrorGroup } from './types'
import {
  isNodeExecutionId,
  parseNodeExecutionId
} from '@/types/nodeIdentification'

interface GroupEntry {
  priority: number
  cards: Map<string, ErrorCardData>
}

interface ErrorSearchItem {
  groupIndex: number
  cardIndex: number
  searchableNodeId: string
  searchableNodeTitle: string
  searchableMessage: string
  searchableDetails: string
}

const KNOWN_PROMPT_ERROR_TYPES = new Set(['prompt_no_outputs', 'no_prompt'])

function resolveNodeInfo(nodeId: string): {
  title: string
  graphNodeId: string | undefined
} {
  const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)

  // For group node internals, resolve the parent group node's title instead
  const parts = parseNodeExecutionId(nodeId)
  const parentId = parts && parts.length > 1 ? String(parts[0]) : null
  const parentNode = parentId
    ? app.rootGraph.getNodeById(Number(parentId))
    : null
  const isParentGroupNode = parentNode ? isGroupNode(parentNode) : false

  return {
    title: isParentGroupNode
      ? (parentNode?.title || '')
      : resolveNodeDisplayName(graphNode, {
          emptyLabel: '',
          untitledLabel: '',
          st
        }),
    graphNodeId: graphNode ? String(graphNode.id) : undefined
  }
}

function getOrCreateGroup(
  groupsMap: Map<string, GroupEntry>,
  title: string,
  priority = 1
): Map<string, ErrorCardData> {
  let entry = groupsMap.get(title)
  if (!entry) {
    entry = { priority, cards: new Map() }
    groupsMap.set(title, entry)
  }
  return entry.cards
}

function processPromptError(
  groupsMap: Map<string, GroupEntry>,
  executionStore: ReturnType<typeof useExecutionStore>,
  selectedNodeIds: Set<string> | null,
  t: (key: string) => string
) {
  // Prompt errors are only shown when no nodes are selected
  if (selectedNodeIds || !executionStore.lastPromptError) return

  const error = executionStore.lastPromptError
  const groupTitle = error.message
  const cards = getOrCreateGroup(groupsMap, groupTitle, 0)
  const isKnown = KNOWN_PROMPT_ERROR_TYPES.has(error.type)

  cards.set('__prompt__', {
    id: '__prompt__',
    title: groupTitle,
    errors: [
      {
        message: isKnown
          ? t(`rightSidePanel.promptErrors.${error.type}.desc`)
          : error.message
      }
    ]
  })
}

function isNodeSelected(
  executionNodeId: string,
  selectedNodeIds: Set<string> | null,
  selectedContainerIds: Set<string>,
  executionIdMap: Map<string, LGraphNode>
): boolean {
  if (!selectedNodeIds) return true

  const graphNode = executionIdMap.get(executionNodeId)
  if (graphNode && selectedNodeIds.has(String(graphNode.id))) return true

  for (const containerId of selectedContainerIds) {
    if (executionNodeId.startsWith(`${containerId}:`)) return true
  }

  return false
}

function processNodeErrors(
  groupsMap: Map<string, GroupEntry>,
  executionStore: ReturnType<typeof useExecutionStore>,
  singleMode: boolean,
  selectedNodeIds: Set<string> | null,
  selectedContainerIds: Set<string>,
  executionIdMap: Map<string, LGraphNode>
) {
  if (!executionStore.lastNodeErrors) return

  for (const [nodeId, nodeError] of Object.entries(
    executionStore.lastNodeErrors
  )) {
    if (
      !isNodeSelected(
        nodeId,
        selectedNodeIds,
        selectedContainerIds,
        executionIdMap
      )
    )
      continue

    const groupKey = singleMode ? '__single__' : nodeError.class_type
    const cards = getOrCreateGroup(groupsMap, groupKey, 1)
    if (!cards.has(nodeId)) {
      const nodeInfo = resolveNodeInfo(nodeId)
      const parts = parseNodeExecutionId(nodeId)
      const parentId = parts && parts.length > 1 ? String(parts[0]) : null
      const parentNode = parentId
        ? app.rootGraph.getNodeById(Number(parentId))
        : null
      const isParentGroupNode = parentNode ? isGroupNode(parentNode) : false

      cards.set(nodeId, {
        id: `node-${nodeId}`,
        title: nodeError.class_type,
        nodeId,
        nodeTitle: nodeInfo.title,
        graphNodeId: nodeInfo.graphNodeId,
        isSubgraphNode: isNodeExecutionId(nodeId) && !isParentGroupNode,
        errors: []
      })
    }
    const card = cards.get(nodeId)
    if (!card) continue
    card.errors.push(
      ...nodeError.errors.map((e) => ({
        message: e.message,
        details: e.details ?? undefined
      }))
    )
  }
}

function processExecutionError(
  groupsMap: Map<string, GroupEntry>,
  executionStore: ReturnType<typeof useExecutionStore>,
  singleMode: boolean,
  selectedNodeIds: Set<string> | null,
  selectedContainerIds: Set<string>,
  executionIdMap: Map<string, LGraphNode>
) {
  if (!executionStore.lastExecutionError) return

  const e = executionStore.lastExecutionError
  const nodeId = String(e.node_id)

  if (
    !isNodeSelected(
      nodeId,
      selectedNodeIds,
      selectedContainerIds,
      executionIdMap
    )
  )
    return

  const groupKey = singleMode ? '__single__' : e.node_type
  const cards = getOrCreateGroup(groupsMap, groupKey, 1)

  if (!cards.has(nodeId)) {
    const nodeInfo = resolveNodeInfo(nodeId)
    const parts = parseNodeExecutionId(nodeId)
    const parentId = parts && parts.length > 1 ? String(parts[0]) : null
    const parentNode = parentId
      ? app.rootGraph.getNodeById(Number(parentId))
      : null
    const isParentGroupNode = parentNode ? isGroupNode(parentNode) : false

    cards.set(nodeId, {
      id: `exec-${nodeId}`,
      title: e.node_type,
      nodeId,
      nodeTitle: nodeInfo.title,
      graphNodeId: nodeInfo.graphNodeId,
      isSubgraphNode: isNodeExecutionId(nodeId) && !isParentGroupNode,
      errors: []
    })
  }
  const card = cards.get(nodeId)
  if (!card) return
  card.errors.push({
    message: `${e.exception_type}: ${e.exception_message}`,
    details: e.traceback.join('\n'),
    isRuntimeError: true
  })
}

function regroupByErrorMessage(
  groupsMap: Map<string, GroupEntry>
): ErrorGroup[] {
  const allCards = Array.from(groupsMap.values()).flatMap((g) =>
    Array.from(g.cards.values())
  )
  const messageMap = new Map<string, GroupEntry>()
  for (const card of allCards) {
    for (const error of card.errors) {
      const msgKey = error.message
      if (!messageMap.has(msgKey)) {
        messageMap.set(msgKey, { priority: 1, cards: new Map() })
      }
      const msgGroup = messageMap.get(msgKey)
      if (!msgGroup) continue
      if (!msgGroup.cards.has(card.id)) {
        msgGroup.cards.set(card.id, { ...card, errors: [] })
      }
      const targetCard = msgGroup.cards.get(card.id)
      if (targetCard) targetCard.errors.push(error)
    }
  }

  return Array.from(messageMap.entries())
    .map(([title, groupData]) => ({
      title,
      cards: Array.from(groupData.cards.values()),
      priority: groupData.priority
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

function toSortedGroups(groupsMap: Map<string, GroupEntry>): ErrorGroup[] {
  return Array.from(groupsMap.entries())
    .map(([title, groupData]) => ({
      title,
      cards: Array.from(groupData.cards.values()),
      priority: groupData.priority
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.title.localeCompare(b.title)
    })
}

function buildErrorGroups(
  executionStore: ReturnType<typeof useExecutionStore>,
  singleMode: boolean,
  selectedNodeIds: Set<string> | null,
  selectedContainerIds: Set<string>,
  executionIdMap: Map<string, LGraphNode>,
  t: (key: string) => string
): ErrorGroup[] {
  const groupsMap = new Map<string, GroupEntry>()

  processPromptError(groupsMap, executionStore, selectedNodeIds, t)
  processNodeErrors(
    groupsMap,
    executionStore,
    singleMode,
    selectedNodeIds,
    selectedContainerIds,
    executionIdMap
  )
  processExecutionError(
    groupsMap,
    executionStore,
    singleMode,
    selectedNodeIds,
    selectedContainerIds,
    executionIdMap
  )

  if (singleMode) {
    return regroupByErrorMessage(groupsMap)
  }

  return toSortedGroups(groupsMap)
}

function searchErrorGroups(groups: ErrorGroup[], query: string): ErrorGroup[] {
  if (!query) return groups

  const searchableList: ErrorSearchItem[] = []
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]!
    for (let ci = 0; ci < group.cards.length; ci++) {
      const card = group.cards[ci]!
      searchableList.push({
        groupIndex: gi,
        cardIndex: ci,
        searchableNodeId: card.nodeId ?? '',
        searchableNodeTitle: card.nodeTitle ?? '',
        searchableMessage: card.errors.map((e) => e.message).join(' '),
        searchableDetails: card.errors.map((e) => e.details ?? '').join(' ')
      })
    }
  }

  const fuseOptions: IFuseOptions<ErrorSearchItem> = {
    keys: [
      { name: 'searchableNodeId', weight: 0.3 },
      { name: 'searchableNodeTitle', weight: 0.3 },
      { name: 'searchableMessage', weight: 0.3 },
      { name: 'searchableDetails', weight: 0.1 }
    ],
    threshold: 0.3
  }

  const fuse = new Fuse(searchableList, fuseOptions)
  const results = fuse.search(query)

  const matchedCardKeys = new Set(
    results.map((r) => `${r.item.groupIndex}:${r.item.cardIndex}`)
  )

  return groups
    .map((group, gi) => ({
      ...group,
      cards: group.cards.filter((_, ci) => matchedCardKeys.has(`${gi}:${ci}`))
    }))
    .filter((group) => group.cards.length > 0)
}

export function useErrorGroups(
  searchQuery: Ref<string>,
  t: (key: string) => string
) {
  const executionStore = useExecutionStore()
  const canvasStore = useCanvasStore()

  const selectedGraphNodeIds = computed<Set<string> | null>(() => {
    const items = canvasStore.selectedItems
    if (items.length === 0) return null
    const nodes = items.filter(isLGraphNode)
    if (nodes.length === 0) return null
    return new Set(nodes.map((n) => String(n.id)))
  })

  const selectedContainerNodeIds = computed<Set<string>>(() => {
    const items = canvasStore.selectedItems
    const ids = new Set<string>()
    for (const item of items) {
      if (!isLGraphNode(item)) continue
      if (item instanceof SubgraphNode || isGroupNode(item)) {
        ids.add(String(item.id))
      }
    }
    return ids
  })

  const isSingleNodeSelected = computed(
    () =>
      selectedGraphNodeIds.value?.size === 1 &&
      selectedContainerNodeIds.value.size === 0
  )

  const executionIdToGraphNodeMap = computed(() => {
    const map = new Map<string, LGraphNode>()
    const allExecutionIds = [
      ...Object.keys(executionStore.lastNodeErrors ?? {}),
      ...(executionStore.lastExecutionError
        ? [String(executionStore.lastExecutionError.node_id)]
        : [])
    ]
    for (const execId of allExecutionIds) {
      const node = getNodeByExecutionId(app.rootGraph, execId)
      if (node) map.set(execId, node)
    }
    return map
  })

  const errorGroups = computed<ErrorGroup[]>(() =>
    buildErrorGroups(
      executionStore,
      isSingleNodeSelected.value,
      selectedGraphNodeIds.value,
      selectedContainerNodeIds.value,
      executionIdToGraphNodeMap.value,
      t
    )
  )

  const filteredGroups = computed<ErrorGroup[]>(() => {
    const query = searchQuery.value.trim()
    return searchErrorGroups(errorGroups.value, query)
  })

  return {
    errorGroups,
    filteredGroups,
    isSingleNodeSelected,
    executionIdToGraphNodeMap
  }
}
