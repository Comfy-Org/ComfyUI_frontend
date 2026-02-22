import { computed, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
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
import type { MissingNodeType } from '@/types/comfy'
import type {
  ErrorCardData,
  ErrorGroup,
  ErrorGroupType,
  ErrorItem
} from './types'
import { isNodeExecutionId } from '@/types/nodeIdentification'

const PROMPT_CARD_ID = '__prompt__'
const SINGLE_GROUP_KEY = '__single__'
const KNOWN_PROMPT_ERROR_TYPES = new Set([
  'prompt_no_outputs',
  'no_prompt',
  'server_error'
])

/** Sentinel: distinguishes "fetch in-flight" from "fetch done, pack not found (null)". */
const RESOLVING = '__RESOLVING__'

/**
 * A group of missing node types belonging to the same node pack.
 */
export interface MissingPackGroup {
  /** Registry pack ID (cnrId). null = could not be resolved. */
  packId: string | null
  /** Missing node types belonging to this pack. */
  nodeTypes: MissingNodeType[]
  /** True while async pack inference is still in progress for this group. */
  isResolving: boolean
}

interface GroupEntry {
  type: ErrorGroupType
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
  priority = 1,
  type: ErrorGroupType = 'execution'
): Map<string, ErrorCardData> {
  let entry = groupsMap.get(title)
  if (!entry) {
    entry = { type, priority, cards: new Map() }
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
      type: groupData.type,
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
  const executionErrorStore = useExecutionErrorStore()
  const canvasStore = useCanvasStore()
  const { inferPackFromNodeName } = useComfyRegistryStore()
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
    for (const execId of executionErrorStore.allErrorExecutionIds) {
      const node = getNodeByExecutionId(app.rootGraph, execId)
      if (node) map.set(execId, node)
    }
    return map
  })

  const missingNodeCache = computed(() => {
    const map = new Map<string, LGraphNode>()
    const nodeTypes = executionErrorStore.missingNodesError?.nodeTypes ?? []
    for (const nodeType of nodeTypes) {
      if (typeof nodeType === 'string') continue
      if (nodeType.nodeId == null) continue
      const nodeId = String(nodeType.nodeId)
      const node = getNodeByExecutionId(app.rootGraph, nodeId)
      if (node) map.set(nodeId, node)
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
    if (selectedNodeInfo.value.nodeIds || !executionErrorStore.lastPromptError)
      return

    const error = executionErrorStore.lastPromptError
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
    if (!executionErrorStore.lastNodeErrors) return

    for (const [nodeId, nodeError] of Object.entries(
      executionErrorStore.lastNodeErrors
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
    if (!executionErrorStore.lastExecutionError) return

    const e = executionErrorStore.lastExecutionError
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

  // Async pack-ID resolution for missing node types that lack a cnrId
  const asyncResolvedIds = ref<Map<string, string | null>>(new Map())

  const pendingTypes = computed(() =>
    (executionErrorStore.missingNodesError?.nodeTypes ?? []).filter(
      (n): n is Exclude<MissingNodeType, string> =>
        typeof n !== 'string' && !n.cnrId
    )
  )

  watch(
    pendingTypes,
    async (pending) => {
      for (const nodeType of pending) {
        const typeName = nodeType.type
        if (asyncResolvedIds.value.has(typeName)) continue
        asyncResolvedIds.value = new Map(asyncResolvedIds.value).set(
          typeName,
          RESOLVING
        )
        const pack = await inferPackFromNodeName.call(typeName)
        asyncResolvedIds.value = new Map(asyncResolvedIds.value).set(
          typeName,
          pack?.id ?? null
        )
      }
    },
    { immediate: true }
  )

  const missingPackGroups = computed<MissingPackGroup[]>(() => {
    const nodeTypes = executionErrorStore.missingNodesError?.nodeTypes ?? []
    const map = new Map<
      string | null,
      { nodeTypes: MissingNodeType[]; isResolving: boolean }
    >()
    const resolvingKeys = new Set<string | null>()

    for (const nodeType of nodeTypes) {
      let packId: string | null

      if (typeof nodeType === 'string') {
        packId = null
      } else if (nodeType.cnrId) {
        packId = nodeType.cnrId
      } else {
        const resolved = asyncResolvedIds.value.get(nodeType.type)
        if (resolved === undefined || resolved === RESOLVING) {
          packId = null
          resolvingKeys.add(null)
        } else {
          packId = resolved
        }
      }

      const existing = map.get(packId)
      if (existing) {
        existing.nodeTypes.push(nodeType)
      } else {
        map.set(packId, { nodeTypes: [nodeType], isResolving: false })
      }
    }

    for (const key of resolvingKeys) {
      const group = map.get(key)
      if (group) group.isResolving = true
    }

    return Array.from(map.entries())
      .sort(([packIdA], [packIdB]) => {
        // null (Unknown Pack) always goes last
        if (packIdA === null) return 1
        if (packIdB === null) return -1
        return packIdA.localeCompare(packIdB)
      })
      .map(([packId, { nodeTypes, isResolving }]) => ({
        packId,
        nodeTypes: [...nodeTypes].sort((a, b) => {
          const typeA = typeof a === 'string' ? a : a.type
          const typeB = typeof b === 'string' ? b : b.type
          const typeCmp = typeA.localeCompare(typeB)
          if (typeCmp !== 0) return typeCmp
          const idA = typeof a === 'string' ? 0 : Number(a.nodeId ?? 0)
          const idB = typeof b === 'string' ? 0 : Number(b.nodeId ?? 0)
          return idA - idB
        }),
        isResolving
      }))
  })

  /** Builds an ErrorGroup from missingNodesError. Returns [] when none present. */
  function buildMissingNodeGroups(): ErrorGroup[] {
    const error = executionErrorStore.missingNodesError
    if (!error) return []

    return [
      {
        type: 'missing_node' as const,
        title: error.message,
        cards: [
          {
            id: '__missing_nodes__',
            title: error.message,
            errors: [
              {
                message: error.message
              }
            ]
          }
        ],
        priority: 0
      }
    ]
  }

  const allErrorGroups = computed<ErrorGroup[]>(() => {
    const groupsMap = new Map<string, GroupEntry>()

    processPromptError(groupsMap)
    processNodeErrors(groupsMap)
    processExecutionError(groupsMap)

    return [...buildMissingNodeGroups(), ...toSortedGroups(groupsMap)]
  })

  const tabErrorGroups = computed<ErrorGroup[]>(() => {
    const groupsMap = new Map<string, GroupEntry>()

    processPromptError(groupsMap)
    processNodeErrors(groupsMap, true)
    processExecutionError(groupsMap, true)

    const executionGroups = isSingleNodeSelected.value
      ? toSortedGroups(regroupByErrorMessage(groupsMap))
      : toSortedGroups(groupsMap)

    return [...buildMissingNodeGroups(), ...executionGroups]
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
    missingNodeCache,
    groupedErrorMessages,
    missingPackGroups
  }
}
