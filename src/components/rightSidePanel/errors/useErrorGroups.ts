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
  getExecutionIdByNode
} from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { st } from '@/i18n'
import type { MissingNodeType } from '@/types/comfy'
import type { ErrorCardData, ErrorGroup, ErrorItem } from './types'
import { shouldRenderExecutionItemList } from './executionItemList'
import { someNodeTypeInSelection } from './selectionEmphasis'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import type { ResolvedCatalogErrorMessage } from '@/platform/errorCatalog/types'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import {
  countMissingModels,
  groupMissingModelCandidates
} from '@/platform/missingModel/missingModelGrouping'
import { groupCandidatesByMediaType } from '@/platform/missingMedia/missingMediaScan'
import { countMissingMediaReferences } from '@/platform/missingMedia/missingMediaGrouping'
import {
  resolveMissingErrorMessage,
  resolveRunErrorMessage
} from '@/platform/errorCatalog/errorMessageResolver'
import {
  compareExecutionId,
  tryNormalizeNodeExecutionId
} from '@/types/nodeIdentification'

const PROMPT_CARD_ID = '__prompt__'

/** Sentinel: distinguishes "fetch in-flight" from "fetch done, pack not found (null)". */
const RESOLVING = '__RESOLVING__'

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
  displayTitle: string
  displayMessage?: string
  priority: number
  cards: Map<string, ErrorCardData>
}

interface ErrorSearchItem {
  groupIndex: number
  cardIndex: number
  searchableNodeId: string
  searchableNodeTitle: string
  searchableRawMessage: string
  searchableRawDetails: string
  searchableMessage: string
  searchableDetails: string
}

type CataloguedErrorItem = ErrorItem & ResolvedCatalogErrorMessage

/** Resolve display info for a node by its execution ID. */
function resolveNodeInfo(nodeId: NodeExecutionId) {
  const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)

  return {
    title: resolveNodeDisplayName(graphNode, {
      emptyLabel: '',
      untitledLabel: '',
      st
    }),
    graphNodeId: graphNode ? String(graphNode.id) : undefined
  }
}

function getOrCreateGroup(
  groupsMap: Map<string, GroupEntry>,
  groupKey: string,
  displayTitle = groupKey,
  priority = 1,
  displayMessage?: string
): Map<string, ErrorCardData> {
  let entry = groupsMap.get(groupKey)
  if (!entry) {
    entry = {
      type: 'execution',
      displayTitle,
      displayMessage,
      priority,
      cards: new Map()
    }
    groupsMap.set(groupKey, entry)
  } else if (!entry.displayMessage && displayMessage) {
    entry.displayMessage = displayMessage
  }
  return entry.cards
}

function createErrorCard(
  nodeId: NodeExecutionId,
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
    errors: []
  }
}

function compareNodeId(a: ErrorCardData, b: ErrorCardData): number {
  return compareExecutionId(a.nodeId, b.nodeId)
}

function countExecutionCards(cards: ErrorCardData[]): number {
  if (shouldRenderExecutionItemList(cards)) {
    return cards.reduce((count, card) => count + card.errors.length, 0)
  }

  return cards.length
}

function toSortedGroups(groupsMap: Map<string, GroupEntry>): ErrorGroup[] {
  return Array.from(groupsMap.entries())
    .map(([rawGroupKey, groupData]) => {
      const cards = Array.from(groupData.cards.values()).sort(compareNodeId)
      return {
        type: 'execution' as const,
        groupKey: `execution:${rawGroupKey}`,
        displayTitle: groupData.displayTitle,
        displayMessage: groupData.displayMessage,
        count: countExecutionCards(cards),
        cards,
        priority: groupData.priority
      }
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.displayTitle.localeCompare(b.displayTitle)
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
        searchableRawMessage: card.errors.map((e) => e.message).join(' '),
        searchableRawDetails: card.errors.map((e) => e.details).join(' '),
        searchableMessage: card.errors
          .map((e) =>
            [e.displayTitle, e.displayMessage, e.message]
              .filter(Boolean)
              .join(' ')
          )
          .join(' '),
        searchableDetails: card.errors
          .map((e) => [e.displayDetails, e.details].filter(Boolean).join(' '))
          .join(' ')
      })
    }
  }

  const fuseOptions: IFuseOptions<ErrorSearchItem> = {
    keys: [
      { name: 'searchableRawMessage', weight: 0.3 },
      { name: 'searchableNodeId', weight: 0.2 },
      { name: 'searchableNodeTitle', weight: 0.2 },
      { name: 'searchableMessage', weight: 0.2 },
      { name: 'searchableRawDetails', weight: 0.1 },
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
      const cards = group.cards.filter((_: ErrorCardData, ci: number) =>
        matchedCardKeys.has(`${gi}:${ci}`)
      )
      return {
        ...group,
        cards,
        count: countExecutionCards(cards)
      }
    })
    .filter((group) => group.type !== 'execution' || group.cards.length > 0)
}

export function useErrorGroups(searchQuery: MaybeRefOrGetter<string>) {
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
      if (item instanceof SubgraphNode && app.rootGraph) {
        const execId = getExecutionIdByNode(app.rootGraph, item)
        if (execId) containerExecutionIds.add(execId)
      }
    }

    return {
      nodeIds: nodeIds.size > 0 ? nodeIds : null,
      containerExecutionIds
    }
  })

  const hasSelection = computed(() => selectedNodeInfo.value.nodeIds !== null)

  const selectedNodeCount = computed(
    () => selectedNodeInfo.value.nodeIds?.size ?? 0
  )

  const selectedNodeTitle = computed(() => {
    if (selectedNodeCount.value !== 1) return null
    const node = canvasStore.selectedItems.find(isLGraphNode)
    if (!node) return null
    return (
      resolveNodeDisplayName(node, {
        emptyLabel: '',
        untitledLabel: '',
        st
      }) || null
    )
  })

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

  function isErrorInSelection(executionNodeId: NodeExecutionId): boolean {
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
    nodeId: NodeExecutionId,
    classType: string,
    idPrefix: string,
    error: CataloguedErrorItem,
    filterBySelection = false
  ) {
    if (filterBySelection && !isErrorInSelection(nodeId)) return
    const cards = getOrCreateGroup(
      groupsMap,
      error.catalogId,
      error.displayTitle ?? classType,
      1,
      error.displayMessage
    )
    if (!cards.has(nodeId)) {
      cards.set(nodeId, createErrorCard(nodeId, classType, idPrefix))
    }
    const card = cards.get(nodeId)
    if (!card) return
    card.errors.push(error)
  }

  function processPromptError(
    groupsMap: Map<string, GroupEntry>,
    filterBySelection = false
  ) {
    if (
      (filterBySelection && selectedNodeInfo.value.nodeIds) ||
      !executionErrorStore.lastPromptError
    )
      return

    const error = executionErrorStore.lastPromptError
    const resolvedDisplay = resolveRunErrorMessage({
      kind: 'prompt',
      error,
      isCloud
    })
    const groupDisplayTitle = resolvedDisplay.displayTitle ?? error.message
    const cards = getOrCreateGroup(
      groupsMap,
      `prompt:${error.type}`,
      groupDisplayTitle,
      0,
      resolvedDisplay.displayMessage
    )

    // Prompt errors are not tied to a node, so they bypass addNodeErrorToGroup.
    cards.set(PROMPT_CARD_ID, {
      id: PROMPT_CARD_ID,
      title: groupDisplayTitle,
      errors: [
        {
          message: error.message,
          ...resolvedDisplay
        }
      ]
    })
  }

  function processNodeErrors(
    groupsMap: Map<string, GroupEntry>,
    filterBySelection = false
  ) {
    if (!executionErrorStore.surfacedNodeErrors) return

    for (const [rawNodeId, nodeError] of Object.entries(
      executionErrorStore.surfacedNodeErrors
    )) {
      const nodeId = tryNormalizeNodeExecutionId(rawNodeId)
      if (!nodeId) continue
      const nodeDisplayName =
        resolveNodeInfo(nodeId).title || nodeError.class_type
      for (const e of nodeError.errors) {
        addNodeErrorToGroup(
          groupsMap,
          nodeId,
          nodeError.class_type,
          'node',
          {
            message: e.message,
            details: e.details ?? undefined,
            ...resolveRunErrorMessage({
              kind: 'node_validation',
              error: e,
              nodeDisplayName
            })
          },
          filterBySelection
        )
      }
    }
  }

  function processExecutionError(
    groupsMap: Map<string, GroupEntry>,
    filterBySelection = false
  ) {
    if (!executionErrorStore.lastExecutionError) return

    const e = executionErrorStore.lastExecutionError
    const nodeId = tryNormalizeNodeExecutionId(e.node_id)
    if (!nodeId) return

    addNodeErrorToGroup(
      groupsMap,
      nodeId,
      e.node_type,
      'exec',
      {
        message: `${e.exception_type}: ${e.exception_message}`,
        details: e.traceback.join('\n'),
        isRuntimeError: true,
        exceptionType: e.exception_type,
        ...resolveRunErrorMessage({
          kind: 'execution',
          error: e,
          nodeDisplayName: resolveNodeInfo(nodeId).title || e.node_type
        })
      },
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

  /**
   * Builds ErrorGroups from missingNodesError. Returns [] when none present.
   * `includeGroup` narrows which swap/pack groups are counted (used to scope
   * emphasis to the canvas selection); groups reduced to zero are omitted.
   */
  function buildMissingNodeGroups(
    includeGroup: (nodeTypes: MissingNodeType[]) => boolean = () => true
  ): ErrorGroup[] {
    const error = missingNodesStore.missingNodesError
    if (!error) return []

    const groups: ErrorGroup[] = []
    const swapCount = swapNodeGroups.value.filter((group) =>
      includeGroup(group.nodeTypes)
    ).length
    const packCount = missingPackGroups.value.filter((group) =>
      includeGroup(group.nodeTypes)
    ).length

    if (swapCount > 0) {
      groups.push({
        type: 'swap_nodes' as const,
        groupKey: 'swap_nodes',
        count: swapCount,
        priority: 0,
        ...resolveMissingErrorMessage({
          kind: 'swap_nodes',
          nodeTypes: error.nodeTypes,
          count: swapCount,
          isCloud
        })
      })
    }

    if (packCount > 0) {
      groups.push({
        type: 'missing_node' as const,
        groupKey: 'missing_node',
        count: packCount,
        priority: 1,
        ...resolveMissingErrorMessage({
          kind: 'missing_node',
          nodeTypes: error.nodeTypes,
          count: packCount,
          isCloud
        })
      })
    }

    return groups.sort((a, b) => a.priority - b.priority)
  }

  const missingModelGroups = computed<MissingModelGroup[]>(() => {
    return groupMissingModelCandidates(
      missingModelStore.missingModelCandidates,
      isCloud
    )
  })

  function buildMissingModelGroups(): ErrorGroup[] {
    if (!missingModelGroups.value.length) return []
    const count = countMissingModels(missingModelGroups.value)
    return [
      {
        type: 'missing_model' as const,
        groupKey: 'missing_model',
        count,
        priority: 2,
        ...resolveMissingErrorMessage({
          kind: 'missing_model',
          groups: missingModelGroups.value,
          count,
          isCloud
        })
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
    const totalRows = countMissingMediaReferences(missingMediaGroups.value)
    return [
      {
        type: 'missing_media' as const,
        groupKey: 'missing_media',
        count: totalRows,
        priority: 3,
        ...resolveMissingErrorMessage({
          kind: 'missing_media',
          groups: missingMediaGroups.value,
          count: totalRows,
          isCloud
        })
      }
    ]
  }

  function isAssetErrorInSelection(executionNodeId: NodeExecutionId): boolean {
    const nodeIds = selectedNodeInfo.value.nodeIds
    if (!nodeIds) return true

    // Try missing node cache first
    const cachedNode = missingNodeCache.value.get(executionNodeId)
    if (cachedNode && nodeIds.has(String(cachedNode.id))) return true

    // Resolve from graph for model/media candidates
    if (app.rootGraph) {
      const graphNode = getNodeByExecutionId(app.rootGraph, executionNodeId)
      if (graphNode && nodeIds.has(String(graphNode.id))) return true
    }

    for (const containerExecId of selectedNodeInfo.value
      .containerExecutionIds) {
      if (executionNodeId.startsWith(`${containerExecId}:`)) return true
    }

    return false
  }

  function isAssetCandidateInSelection(nodeId: string | number): boolean {
    const executionNodeId = tryNormalizeNodeExecutionId(nodeId)
    return executionNodeId ? isAssetErrorInSelection(executionNodeId) : false
  }

  /** Model groups narrowed to the selection, for emphasis derivation only. */
  const missingModelGroupsForSelection = computed(() => {
    if (!hasSelection.value) return []
    const candidates = missingModelStore.missingModelCandidates
    if (!candidates?.length) return []
    const matched = candidates.filter(
      (c) => c.nodeId != null && isAssetCandidateInSelection(c.nodeId)
    )
    if (!matched.length) return []
    return groupMissingModelCandidates(matched, isCloud)
  })

  /** Media groups narrowed to the selection, for emphasis derivation only. */
  const missingMediaGroupsForSelection = computed(() => {
    if (!hasSelection.value) return []
    const candidates = missingMediaStore.missingMediaCandidates
    if (!candidates?.length) return []
    const matched = candidates.filter(
      (c) => c.nodeId != null && isAssetCandidateInSelection(c.nodeId)
    )
    if (!matched.length) return []
    return groupCandidatesByMediaType(matched)
  })

  function buildMissingModelGroupsForSelection(): ErrorGroup[] {
    if (!missingModelGroupsForSelection.value.length) return []
    const count = countMissingModels(missingModelGroupsForSelection.value)
    return [
      {
        type: 'missing_model' as const,
        groupKey: 'missing_model',
        count,
        priority: 2,
        ...resolveMissingErrorMessage({
          kind: 'missing_model',
          groups: missingModelGroupsForSelection.value,
          count,
          isCloud
        })
      }
    ]
  }

  function buildMissingMediaGroupsForSelection(): ErrorGroup[] {
    if (!missingMediaGroupsForSelection.value.length) return []
    const totalRows = countMissingMediaReferences(
      missingMediaGroupsForSelection.value
    )
    return [
      {
        type: 'missing_media' as const,
        groupKey: 'missing_media',
        count: totalRows,
        priority: 3,
        ...resolveMissingErrorMessage({
          kind: 'missing_media',
          groups: missingMediaGroupsForSelection.value,
          count: totalRows,
          isCloud
        })
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

  /**
   * The subset of error groups whose errors belong to the current canvas
   * selection. Empty when nothing is selected. Display always shows all
   * groups; this subset only drives selection emphasis (auto-expand, card
   * highlight, context strip).
   */
  const selectionScopedGroups = computed<ErrorGroup[]>(() => {
    if (!hasSelection.value) return []

    const groupsMap = new Map<string, GroupEntry>()
    processPromptError(groupsMap, true)
    processNodeErrors(groupsMap, true)
    processExecutionError(groupsMap, true)

    return [
      ...buildMissingNodeGroups((nodeTypes) =>
        someNodeTypeInSelection(nodeTypes, selectionMatchedAssetNodeIds.value)
      ),
      ...buildMissingModelGroupsForSelection(),
      ...buildMissingMediaGroupsForSelection(),
      ...toSortedGroups(groupsMap)
    ]
  })

  /**
   * Execution node ids referenced by any missing-asset candidate (models,
   * media, missing node types).
   */
  const assetNodeIdsWithError = computed<string[]>(() => {
    const candidateIds = [
      ...(missingModelStore.missingModelCandidates ?? []),
      ...(missingMediaStore.missingMediaCandidates ?? [])
    ].map((candidate) => candidate.nodeId)
    const missingNodeTypeIds = (
      missingNodesStore.missingNodesError?.nodeTypes ?? []
    ).map((nodeType) =>
      typeof nodeType === 'string' ? undefined : nodeType.nodeId
    )
    return [...candidateIds, ...missingNodeTypeIds]
      .filter((nodeId) => nodeId != null)
      .map(String)
  })

  /**
   * Asset node ids that belong to the current selection. Drives row-level
   * highlighting inside the missing-* cards.
   */
  const selectionMatchedAssetNodeIds = computed<Set<string>>(() => {
    if (!hasSelection.value) return new Set()
    return new Set(
      assetNodeIdsWithError.value.filter(isAssetCandidateInSelection)
    )
  })

  const selectionMatchedGroupKeys = computed<Set<string>>(() => {
    if (!hasSelection.value) return new Set()
    return new Set(selectionScopedGroups.value.map((group) => group.groupKey))
  })

  const selectionMatchedCardIds = computed<Set<string>>(() => {
    if (!hasSelection.value) return new Set()
    return new Set(
      selectionScopedGroups.value
        .flatMap((group) => (group.type === 'execution' ? group.cards : []))
        .map((card) => card.id)
    )
  })

  const selectionErrorCount = computed(() => {
    if (!hasSelection.value) return 0
    return selectionScopedGroups.value.reduce(
      (sum, group) => sum + group.count,
      0
    )
  })

  /** Distinct nodes affected by any error (workflow-level summary). */
  const errorNodeCount = computed(() => {
    const executionNodeIds = allErrorGroups.value
      .flatMap((group) => (group.type === 'execution' ? group.cards : []))
      .map((card) => card.nodeId)
      .filter((nodeId) => nodeId != null)
    return new Set([...executionNodeIds, ...assetNodeIdsWithError.value]).size
  })

  const filteredGroups = computed<ErrorGroup[]>(() => {
    const query = toValue(searchQuery).trim()
    return searchErrorGroups(allErrorGroups.value, query)
  })

  return {
    allErrorGroups,
    filteredGroups,
    collapseState,
    errorNodeCache,
    missingNodeCache,
    missingPackGroups,
    missingModelGroups,
    missingMediaGroups,
    swapNodeGroups,
    hasSelection,
    selectedNodeCount,
    selectedNodeTitle,
    selectionMatchedGroupKeys,
    selectionMatchedCardIds,
    selectionMatchedAssetNodeIds,
    selectionErrorCount,
    errorNodeCount
  }
}
