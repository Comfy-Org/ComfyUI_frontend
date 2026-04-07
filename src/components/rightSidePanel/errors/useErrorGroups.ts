import { computed, reactive, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { isCloud } from '@/platform/distribution/types'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  getNodeByExecutionId,
  getExecutionIdByNode,
  getRootParentNode
} from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { isGroupNode } from '@/utils/executableGroupNodeDto'
import { st } from '@/i18n'
import type { MissingNodeType } from '@/types/comfy'
import type { ErrorCardData, ErrorGroup, ErrorItem } from './types'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type {
  MissingModelCandidate,
  MissingModelGroup
} from '@/platform/missingModel/types'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import { groupCandidatesByName } from '@/platform/missingModel/missingModelScan'
import { groupCandidatesByMediaType } from '@/platform/missingMedia/missingMediaScan'
import {
  isNodeExecutionId,
  compareExecutionId
} from '@/types/nodeIdentification'

const PROMPT_CARD_ID = '__prompt__'
const SINGLE_GROUP_KEY = '__single__'
const KNOWN_PROMPT_ERROR_TYPES = new Set([
  'prompt_no_outputs',
  'no_prompt',
  'server_error'
])

/** Sentinel: distinguishes "fetch in-flight" from "fetch done, pack not found (null)". */
const RESOLVING = '__RESOLVING__'

/** Sentinel key for grouping non-asset-supported missing models. */
const UNSUPPORTED = Symbol('unsupported')

export interface MissingPackGroup {
  packId: string | null
  nodeTypes: MissingNodeType[]
  isResolving: boolean
}

export interface SwapNodeGroup {
  type: string
  newNodeId: string | undefined
  nodeTypes: MissingNodeType[]
}

interface GroupEntry {
  type: 'execution'
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
    entry = { type: 'execution', priority, cards: new Map() }
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

function compareNodeId(a: ErrorCardData, b: ErrorCardData): number {
  return compareExecutionId(a.nodeId, b.nodeId)
}

function toSortedGroups(groupsMap: Map<string, GroupEntry>): ErrorGroup[] {
  return Array.from(groupsMap.entries())
    .map(([title, groupData]) => ({
      type: 'execution' as const,
      title,
      cards: Array.from(groupData.cards.values()).sort(compareNodeId),
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
    if (group.type !== 'execution') continue
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
    .map((group, gi) => {
      if (group.type !== 'execution') return group
      return {
        ...group,
        cards: group.cards.filter((_: ErrorCardData, ci: number) =>
          matchedCardKeys.has(`${gi}:${ci}`)
        )
      }
    })
    .filter((group) => group.type !== 'execution' || group.cards.length > 0)
}

export function useErrorGroups(
  searchQuery: MaybeRefOrGetter<string>,
  t: (key: string) => string
) {
  const executionErrorStore = useExecutionErrorStore()
  const missingNodesStore = useMissingNodesErrorStore()
  const missingModelStore = useMissingModelStore()
  const missingMediaStore = useMissingMediaStore()
  const canvasStore = useCanvasStore()
  const { inferPackFromNodeName } = useComfyRegistryStore()
  const collapseState = reactive<Record<string, boolean>>({})

  const selectedNodeInfo = computed(() => {
    const items = canvasStore.selectedItems
    const nodeIds = new Set<string>()
    const containerExecutionIds = new Set<NodeExecutionId>()

    for (const item of items) {
      if (!isLGraphNode(item)) continue
      nodeIds.add(String(item.id))
      if (
        (item instanceof SubgraphNode || isGroupNode(item)) &&
        app.rootGraph
      ) {
        const execId = getExecutionIdByNode(app.rootGraph, item)
        if (execId) containerExecutionIds.add(execId)
      }
    }

    return {
      nodeIds: nodeIds.size > 0 ? nodeIds : null,
      containerExecutionIds
    }
  })

  const isSingleNodeSelected = computed(
    () =>
      selectedNodeInfo.value.nodeIds?.size === 1 &&
      selectedNodeInfo.value.containerExecutionIds.size === 0
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
    const nodeTypes = missingNodesStore.missingNodesError?.nodeTypes ?? []
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

    for (const containerExecId of selectedNodeInfo.value
      .containerExecutionIds) {
      if (executionNodeId.startsWith(`${containerExecId}:`)) return true
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
          isRuntimeError: true,
          exceptionType: e.exception_type
        }
      ],
      filterBySelection
    )
  }

  // Async pack-ID resolution for missing node types that lack a cnrId
  const asyncResolvedIds = ref<Map<string, string | null>>(new Map())

  const pendingTypes = computed(() =>
    (missingNodesStore.missingNodesError?.nodeTypes ?? []).filter(
      (n): n is Exclude<MissingNodeType, string> =>
        typeof n !== 'string' && !n.cnrId
    )
  )

  watch(
    pendingTypes,
    async (pending, _, onCleanup) => {
      const toResolve = pending.filter(
        (n) => asyncResolvedIds.value.get(n.type) === undefined
      )
      if (!toResolve.length) return

      const resolvingTypes = toResolve.map((n) => n.type)
      let cancelled = false
      onCleanup(() => {
        cancelled = true
        const next = new Map(asyncResolvedIds.value)
        for (const type of resolvingTypes) {
          if (next.get(type) === RESOLVING) next.delete(type)
        }
        asyncResolvedIds.value = next
      })

      const updated = new Map(asyncResolvedIds.value)
      for (const type of resolvingTypes) updated.set(type, RESOLVING)
      asyncResolvedIds.value = updated

      const results = await Promise.allSettled(
        toResolve.map(async (n) => ({
          type: n.type,
          packId: (await inferPackFromNodeName.call(n.type))?.id ?? null
        }))
      )
      if (cancelled) return

      const final = new Map(asyncResolvedIds.value)
      for (const r of results) {
        if (r.status === 'fulfilled') {
          final.set(r.value.type, r.value.packId)
        } else {
          console.warn('Failed to resolve pack ID:', r.reason)
        }
      }
      // Clear any remaining RESOLVING markers for failed lookups
      for (const type of resolvingTypes) {
        if (final.get(type) === RESOLVING) final.set(type, null)
      }
      asyncResolvedIds.value = final
    },
    { immediate: true }
  )

  // Evict stale entries when missing nodes are cleared
  watch(
    () => missingNodesStore.missingNodesError,
    (error) => {
      if (!error && asyncResolvedIds.value.size > 0) {
        asyncResolvedIds.value = new Map()
      }
    }
  )

  const missingPackGroups = computed<MissingPackGroup[]>(() => {
    const nodeTypes = missingNodesStore.missingNodesError?.nodeTypes ?? []
    const map = new Map<
      string | null,
      { nodeTypes: MissingNodeType[]; isResolving: boolean }
    >()
    const resolvingKeys = new Set<string | null>()

    for (const nodeType of nodeTypes) {
      if (typeof nodeType !== 'string' && nodeType.isReplaceable) continue

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
          const idA = typeof a === 'string' ? '' : String(a.nodeId ?? '')
          const idB = typeof b === 'string' ? '' : String(b.nodeId ?? '')
          return idA.localeCompare(idB, undefined, { numeric: true })
        }),
        isResolving
      }))
  })

  const swapNodeGroups = computed<SwapNodeGroup[]>(() => {
    const nodeTypes = missingNodesStore.missingNodesError?.nodeTypes ?? []
    const map = new Map<string, SwapNodeGroup>()

    for (const nodeType of nodeTypes) {
      if (typeof nodeType === 'string' || !nodeType.isReplaceable) continue

      const typeName = nodeType.type
      const existing = map.get(typeName)
      if (existing) {
        existing.nodeTypes.push(nodeType)
      } else {
        map.set(typeName, {
          type: typeName,
          newNodeId: nodeType.replacement?.new_node_id,
          nodeTypes: [nodeType]
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => a.type.localeCompare(b.type))
  })

  /** Builds an ErrorGroup from missingNodesError. Returns [] when none present. */
  function buildMissingNodeGroups(): ErrorGroup[] {
    const error = missingNodesStore.missingNodesError
    if (!error) return []

    const groups: ErrorGroup[] = []

    if (swapNodeGroups.value.length > 0) {
      groups.push({
        type: 'swap_nodes' as const,
        title: st('nodeReplacement.swapNodesTitle', 'Swap Nodes'),
        priority: 0
      })
    }

    if (missingPackGroups.value.length > 0) {
      groups.push({
        type: 'missing_node' as const,
        title: error.message,
        priority: 1
      })
    }

    return groups.sort((a, b) => a.priority - b.priority)
  }

  /** Groups missing models. Asset-supported models group by directory; others go into a separate group.
   *  Within each group, candidates with the same model name are merged into a single view model. */
  const missingModelGroups = computed<MissingModelGroup[]>(() => {
    const candidates = missingModelStore.missingModelCandidates
    if (!candidates?.length) return []

    type GroupKey = string | null | typeof UNSUPPORTED
    const map = new Map<
      GroupKey,
      { candidates: MissingModelCandidate[]; isAssetSupported: boolean }
    >()

    for (const c of candidates) {
      const groupKey: GroupKey =
        c.isAssetSupported || !isCloud ? c.directory || null : UNSUPPORTED

      const existing = map.get(groupKey)
      if (existing) {
        existing.candidates.push(c)
      } else {
        // All candidates in the same directory share the same isAssetSupported
        // value in practice (a directory is either asset-supported or not).
        map.set(groupKey, {
          candidates: [c],
          isAssetSupported: c.isAssetSupported
        })
      }
    }

    return Array.from(map.entries())
      .sort(([dirA], [dirB]) => {
        if (dirA === UNSUPPORTED) return 1
        if (dirB === UNSUPPORTED) return -1
        if (dirA === null) return 1
        if (dirB === null) return -1
        return dirA.localeCompare(dirB)
      })
      .map(([key, { candidates: groupCandidates, isAssetSupported }]) => ({
        directory: typeof key === 'string' ? key : null,
        models: groupCandidatesByName(groupCandidates),
        isAssetSupported
      }))
  })

  function buildMissingModelGroups(): ErrorGroup[] {
    if (!missingModelGroups.value.length) return []
    return [
      {
        type: 'missing_model' as const,
        title: `${t('rightSidePanel.missingModels.missingModelsTitle')} (${missingModelGroups.value.reduce((count, group) => count + group.models.length, 0)})`,
        priority: 2
      }
    ]
  }

  const missingMediaGroups = computed<MissingMediaGroup[]>(() => {
    const candidates = missingMediaStore.missingMediaCandidates
    if (!candidates?.length) return []
    return groupCandidatesByMediaType(candidates)
  })

  function buildMissingMediaGroups(): ErrorGroup[] {
    if (!missingMediaGroups.value.length) return []
    const totalItems = missingMediaGroups.value.reduce(
      (count, group) => count + group.items.length,
      0
    )
    return [
      {
        type: 'missing_media' as const,
        title: `${t('rightSidePanel.missingMedia.missingMediaTitle')} (${totalItems})`,
        priority: 3
      }
    ]
  }

  const allErrorGroups = computed<ErrorGroup[]>(() => {
    const groupsMap = new Map<string, GroupEntry>()

    processPromptError(groupsMap)
    processNodeErrors(groupsMap)
    processExecutionError(groupsMap)

    return [
      ...buildMissingNodeGroups(),
      ...buildMissingModelGroups(),
      ...buildMissingMediaGroups(),
      ...toSortedGroups(groupsMap)
    ]
  })

  const tabErrorGroups = computed<ErrorGroup[]>(() => {
    const groupsMap = new Map<string, GroupEntry>()

    processPromptError(groupsMap)
    processNodeErrors(groupsMap, true)
    processExecutionError(groupsMap, true)

    const executionGroups = isSingleNodeSelected.value
      ? toSortedGroups(regroupByErrorMessage(groupsMap))
      : toSortedGroups(groupsMap)

    return [
      ...buildMissingNodeGroups(),
      ...buildMissingModelGroups(),
      ...buildMissingMediaGroups(),
      ...executionGroups
    ]
  })

  const filteredGroups = computed<ErrorGroup[]>(() => {
    const query = toValue(searchQuery).trim()
    return searchErrorGroups(tabErrorGroups.value, query)
  })

  const groupedErrorMessages = computed<string[]>(() => {
    const messages = new Set<string>()
    for (const group of allErrorGroups.value) {
      if (group.type === 'execution') {
        for (const card of group.cards) {
          for (const err of card.errors) {
            messages.add(err.message)
          }
        }
      } else {
        messages.add(group.title)
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
    missingPackGroups,
    missingModelGroups,
    missingMediaGroups,
    swapNodeGroups
  }
}
