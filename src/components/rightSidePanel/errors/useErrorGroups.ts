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
import type { ResolvedCatalogErrorMessage } from '@/platform/errorCatalog/types'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import { groupCandidatesByName } from '@/platform/missingModel/missingModelScan'
import { groupCandidatesByMediaType } from '@/platform/missingMedia/missingMediaScan'
import { countMissingMediaReferences } from '@/platform/missingMedia/missingMediaGrouping'
import {
  resolveMissingErrorMessage,
  resolveRunErrorMessage
} from '@/platform/errorCatalog/errorMessageResolver'
import {
  isNodeExecutionId,
  compareExecutionId
} from '@/types/nodeIdentification'

const PROMPT_CARD_ID = '__prompt__'

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

function compareNodeId(a: ErrorCardData, b: ErrorCardData): number {
  return compareExecutionId(a.nodeId, b.nodeId)
}

function toSortedGroups(groupsMap: Map<string, GroupEntry>): ErrorGroup[] {
  return Array.from(groupsMap.entries())
    .map(([rawGroupKey, groupData]) => ({
      type: 'execution' as const,
      groupKey: `execution:${rawGroupKey}`,
      displayTitle: groupData.displayTitle,
      displayMessage: groupData.displayMessage,
      cards: Array.from(groupData.cards.values()).sort(compareNodeId),
      priority: groupData.priority
    }))
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
      return {
        ...group,
        cards: group.cards.filter((_: ErrorCardData, ci: number) =>
          matchedCardKeys.has(`${gi}:${ci}`)
        )
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
    if (!executionErrorStore.lastNodeErrors) return

    for (const [nodeId, nodeError] of Object.entries(
      executionErrorStore.lastNodeErrors
    )) {
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
    addNodeErrorToGroup(
      groupsMap,
      String(e.node_id),
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
          nodeDisplayName:
            resolveNodeInfo(String(e.node_id)).title || e.node_type
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

  /** Builds an ErrorGroup from missingNodesError. Returns [] when none present. */
  function buildMissingNodeGroups(): ErrorGroup[] {
    const error = missingNodesStore.missingNodesError
    if (!error) return []

    const groups: ErrorGroup[] = []

    if (swapNodeGroups.value.length > 0) {
      groups.push({
        type: 'swap_nodes' as const,
        groupKey: 'swap_nodes',
        priority: 0,
        ...resolveMissingErrorMessage({
          kind: 'swap_nodes',
          nodeTypes: missingNodesStore.missingNodesError?.nodeTypes ?? [],
          count: swapNodeGroups.value.length,
          isCloud
        })
      })
    }

    if (missingPackGroups.value.length > 0) {
      groups.push({
        type: 'missing_node' as const,
        groupKey: 'missing_node',
        priority: 1,
        ...resolveMissingErrorMessage({
          kind: 'missing_node',
          nodeTypes: error.nodeTypes,
          count: missingPackGroups.value.length,
          isCloud
        })
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
    const count = missingModelGroups.value.reduce(
      (total, group) => total + group.models.length,
      0
    )
    return [
      {
        type: 'missing_model' as const,
        groupKey: 'missing_model',
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

  function isAssetErrorInSelection(executionNodeId: string): boolean {
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

  const filteredMissingModelGroups = computed(() => {
    if (!selectedNodeInfo.value.nodeIds) return missingModelGroups.value
    const candidates = missingModelStore.missingModelCandidates
    if (!candidates?.length) return []
    const filtered = candidates.filter(
      (c) => c.nodeId != null && isAssetErrorInSelection(String(c.nodeId))
    )
    if (!filtered.length) return []

    const map = new Map<
      string | null | typeof UNSUPPORTED,
      { candidates: MissingModelCandidate[]; isAssetSupported: boolean }
    >()
    for (const c of filtered) {
      const groupKey =
        c.isAssetSupported || !isCloud ? c.directory || null : UNSUPPORTED
      const existing = map.get(groupKey)
      if (existing) {
        existing.candidates.push(c)
      } else {
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

  const filteredMissingMediaGroups = computed(() => {
    if (!selectedNodeInfo.value.nodeIds) return missingMediaGroups.value
    const candidates = missingMediaStore.missingMediaCandidates
    if (!candidates?.length) return []
    const filtered = candidates.filter(
      (c) => c.nodeId != null && isAssetErrorInSelection(String(c.nodeId))
    )
    if (!filtered.length) return []
    return groupCandidatesByMediaType(filtered)
  })

  function buildMissingModelGroupsFiltered(): ErrorGroup[] {
    if (!filteredMissingModelGroups.value.length) return []
    const count = filteredMissingModelGroups.value.reduce(
      (total, group) => total + group.models.length,
      0
    )
    return [
      {
        type: 'missing_model' as const,
        groupKey: 'missing_model',
        priority: 2,
        ...resolveMissingErrorMessage({
          kind: 'missing_model',
          groups: filteredMissingModelGroups.value,
          count,
          isCloud
        })
      }
    ]
  }

  function buildMissingMediaGroupsFiltered(): ErrorGroup[] {
    if (!filteredMissingMediaGroups.value.length) return []
    const totalRows = countMissingMediaReferences(
      filteredMissingMediaGroups.value
    )
    return [
      {
        type: 'missing_media' as const,
        groupKey: 'missing_media',
        priority: 3,
        ...resolveMissingErrorMessage({
          kind: 'missing_media',
          groups: filteredMissingMediaGroups.value,
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

  const tabErrorGroups = computed<ErrorGroup[]>(() => {
    const groupsMap = new Map<string, GroupEntry>()

    processPromptError(groupsMap, true)
    processNodeErrors(groupsMap, true)
    processExecutionError(groupsMap, true)

    const filterByNode = selectedNodeInfo.value.nodeIds !== null

    // Missing nodes are intentionally unfiltered — they represent
    // pack-level problems relevant regardless of which node is selected.
    return [
      ...buildMissingNodeGroups(),
      ...(filterByNode
        ? buildMissingModelGroupsFiltered()
        : buildMissingModelGroups()),
      ...(filterByNode
        ? buildMissingMediaGroupsFiltered()
        : buildMissingMediaGroups()),
      ...toSortedGroups(groupsMap)
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
            messages.add(err.displayMessage ?? err.message)
          }
        }
      } else {
        messages.add(group.displayMessage ?? group.displayTitle)
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
    filteredMissingModelGroups,
    filteredMissingMediaGroups,
    swapNodeGroups
  }
}
