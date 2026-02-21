import { computed, reactive } from 'vue'
import type { Ref } from 'vue'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import { app } from '@/scripts/app'
import { isCloud } from '@/platform/distribution/types'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  getNodeByExecutionId,
  getRootParentNode
} from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { isGroupNode } from '@/utils/executableGroupNodeDto'
import { st } from '@/i18n'
import type { ErrorCardData, ErrorGroup, ErrorItem } from './types'
import { isNodeExecutionId } from '@/types/nodeIdentification'

const PROMPT_CARD_ID = '__prompt__'
const SINGLE_GROUP_KEY = '__single__'
const KNOWN_PROMPT_ERROR_TYPES = new Set([
  'prompt_no_outputs',
  'no_prompt',
  'server_error'
])

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

/**
 * Resolve display info for a node by its execution ID.
 * For group node internals, resolves the parent group node's title instead.
 */
function resolveNodeInfo(nodeId: string) {
  const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)

  const parentNode = getRootParentNode(app.rootGraph, nodeId)
  const isParentGroupNode = parentNode ? isGroupNode(parentNode) : false

  return {
    title: isParentGroupNode
      ? parentNode?.title || ''
      : resolveNodeDisplayName(graphNode, {
          emptyLabel: '',
          untitledLabel: '',
          st
        }),
    graphNodeId: graphNode ? String(graphNode.id) : undefined,
    isParentGroupNode
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

function createErrorCard(
  nodeId: string,
  classType: string,
  idPrefix: string
): ErrorCardData {
  const nodeInfo = resolveNodeInfo(nodeId)
  return {
    id: `${idPrefix}-${nodeId}`,
    title: classType,
    nodeId,
    nodeTitle: nodeInfo.title,
    graphNodeId: nodeInfo.graphNodeId,
    isSubgraphNode: isNodeExecutionId(nodeId) && !nodeInfo.isParentGroupNode,
    errors: []
  }
}

/**
 * In single-node mode, regroup cards by error message instead of class_type.
 * This lets the user see "what kinds of errors this node has" at a glance.
 */
function regroupByErrorMessage(
  groupsMap: Map<string, GroupEntry>
): Map<string, GroupEntry> {
  const allCards = Array.from(groupsMap.values()).flatMap((g) =>
    Array.from(g.cards.values())
  )

  const cardErrorPairs = allCards.flatMap((card) =>
    card.errors.map((error) => ({ card, error }))
  )

  const messageMap = new Map<string, GroupEntry>()
  for (const { card, error } of cardErrorPairs) {
    addCardErrorToGroup(messageMap, card, error)
  }

  return messageMap
}

function addCardErrorToGroup(
  messageMap: Map<string, GroupEntry>,
  card: ErrorCardData,
  error: ErrorItem
) {
  const group = getOrCreateGroup(messageMap, error.message, 1)
  if (!group.has(card.id)) {
    group.set(card.id, { ...card, errors: [] })
  }
  group.get(card.id)?.errors.push(error)
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

function searchErrorGroups(groups: ErrorGroup[], query: string) {
  if (!query) return groups

  const searchableList: ErrorSearchItem[] = []
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    for (let ci = 0; ci < group.cards.length; ci++) {
      const card = group.cards[ci]
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
  const collapseState = reactive<Record<string, boolean>>({})

  const selectedNodeInfo = computed(() => {
    const items = canvasStore.selectedItems
    const nodeIds = new Set<string>()
    const containerIds = new Set<string>()

    for (const item of items) {
      if (!isLGraphNode(item)) continue
      nodeIds.add(String(item.id))
      if (item instanceof SubgraphNode || isGroupNode(item)) {
        containerIds.add(String(item.id))
      }
    }

    return {
      nodeIds: nodeIds.size > 0 ? nodeIds : null,
      containerIds
    }
  })

  const isSingleNodeSelected = computed(
    () =>
      selectedNodeInfo.value.nodeIds?.size === 1 &&
      selectedNodeInfo.value.containerIds.size === 0
  )

  const errorNodeCache = computed(() => {
    const map = new Map<string, LGraphNode>()
    for (const execId of executionStore.allErrorExecutionIds) {
      const node = getNodeByExecutionId(app.rootGraph, execId)
      if (node) map.set(execId, node)
    }
    return map
  })

  function isErrorInSelection(executionNodeId: string): boolean {
    const nodeIds = selectedNodeInfo.value.nodeIds
    if (!nodeIds) return true

    const graphNode = errorNodeCache.value.get(executionNodeId)
    if (graphNode && nodeIds.has(String(graphNode.id))) return true

    for (const containerId of selectedNodeInfo.value.containerIds) {
      if (executionNodeId.startsWith(`${containerId}:`)) return true
    }

    return false
  }

  function addNodeErrorToGroup(
    groupsMap: Map<string, GroupEntry>,
    nodeId: string,
    classType: string,
    idPrefix: string,
    errors: ErrorItem[],
    filterBySelection = false
  ) {
    if (filterBySelection && !isErrorInSelection(nodeId)) return
    const groupKey = isSingleNodeSelected.value ? SINGLE_GROUP_KEY : classType
    const cards = getOrCreateGroup(groupsMap, groupKey, 1)
    if (!cards.has(nodeId)) {
      cards.set(nodeId, createErrorCard(nodeId, classType, idPrefix))
    }
    cards.get(nodeId)?.errors.push(...errors)
  }

  function processPromptError(groupsMap: Map<string, GroupEntry>) {
    if (selectedNodeInfo.value.nodeIds || !executionStore.lastPromptError)
      return

    const error = executionStore.lastPromptError
    const groupTitle = error.message
    const cards = getOrCreateGroup(groupsMap, groupTitle, 0)
    const isKnown = KNOWN_PROMPT_ERROR_TYPES.has(error.type)

    // For server_error, resolve the i18n key based on the environment
    let errorTypeKey = error.type
    if (error.type === 'server_error') {
      errorTypeKey = isCloud ? 'server_error_cloud' : 'server_error_local'
    }
    const i18nKey = `rightSidePanel.promptErrors.${errorTypeKey}.desc`

    // Prompt errors are not tied to a node, so they bypass addNodeErrorToGroup.
    cards.set(PROMPT_CARD_ID, {
      id: PROMPT_CARD_ID,
      title: groupTitle,
      errors: [
        {
          message: isKnown ? t(i18nKey) : error.message
        }
      ]
    })
  }

  function processNodeErrors(
    groupsMap: Map<string, GroupEntry>,
    filterBySelection = false
  ) {
    if (!executionStore.lastNodeErrors) return

    for (const [nodeId, nodeError] of Object.entries(
      executionStore.lastNodeErrors
    )) {
      addNodeErrorToGroup(
        groupsMap,
        nodeId,
        nodeError.class_type,
        'node',
        nodeError.errors.map((e) => ({
          message: e.message,
          details: e.details ?? undefined
        })),
        filterBySelection
      )
    }
  }

  function processExecutionError(
    groupsMap: Map<string, GroupEntry>,
    filterBySelection = false
  ) {
    if (!executionStore.lastExecutionError) return

    const e = executionStore.lastExecutionError
    addNodeErrorToGroup(
      groupsMap,
      String(e.node_id),
      e.node_type,
      'exec',
      [
        {
          message: `${e.exception_type}: ${e.exception_message}`,
          details: e.traceback.join('\n'),
          isRuntimeError: true
        }
      ],
      filterBySelection
    )
  }

  const allErrorGroups = computed<ErrorGroup[]>(() => {
    const groupsMap = new Map<string, GroupEntry>()

    processPromptError(groupsMap)
    processNodeErrors(groupsMap)
    processExecutionError(groupsMap)

    return toSortedGroups(groupsMap)
  })

  const tabErrorGroups = computed<ErrorGroup[]>(() => {
    const groupsMap = new Map<string, GroupEntry>()

    processPromptError(groupsMap)
    processNodeErrors(groupsMap, true)
    processExecutionError(groupsMap, true)

    return isSingleNodeSelected.value
      ? toSortedGroups(regroupByErrorMessage(groupsMap))
      : toSortedGroups(groupsMap)
  })

  const filteredGroups = computed<ErrorGroup[]>(() => {
    const query = searchQuery.value.trim()
    return searchErrorGroups(tabErrorGroups.value, query)
  })

  const groupedErrorMessages = computed<string[]>(() => {
    const messages = new Set<string>()
    for (const group of allErrorGroups.value) {
      for (const card of group.cards) {
        for (const err of card.errors) {
          messages.add(err.message)
        }
      }
    }
    return Array.from(messages)
  })

  return {
    allErrorGroups,
    tabErrorGroups,
    filteredGroups,
    collapseState,
    isSingleNodeSelected,
    errorNodeCache,
    groupedErrorMessages
  }
}
