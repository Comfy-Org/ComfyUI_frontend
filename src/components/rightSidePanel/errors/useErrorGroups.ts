import { computed } from 'vue'
import type { Ref } from 'vue'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'

import { useExecutionStore } from '@/stores/executionStore'
import { app } from '@/scripts/app'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { st } from '@/i18n'
import type { ErrorCardData, ErrorGroup } from './types'
import { isNodeExecutionId } from '@/types/nodeIdentification'

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
  t: (key: string) => string
) {
  if (!executionStore.lastPromptError) return

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

function processNodeErrors(
  groupsMap: Map<string, GroupEntry>,
  executionStore: ReturnType<typeof useExecutionStore>
) {
  if (!executionStore.lastNodeErrors) return

  for (const [nodeId, nodeError] of Object.entries(
    executionStore.lastNodeErrors
  )) {
    const cards = getOrCreateGroup(groupsMap, nodeError.class_type, 1)
    if (!cards.has(nodeId)) {
      const nodeInfo = resolveNodeInfo(nodeId)
      cards.set(nodeId, {
        id: `node-${nodeId}`,
        title: nodeError.class_type,
        nodeId,
        nodeTitle: nodeInfo.title,
        graphNodeId: nodeInfo.graphNodeId,
        isSubgraphNode: isNodeExecutionId(nodeId),
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
  executionStore: ReturnType<typeof useExecutionStore>
) {
  if (!executionStore.lastExecutionError) return

  const e = executionStore.lastExecutionError
  const nodeId = String(e.node_id)
  const cards = getOrCreateGroup(groupsMap, e.node_type, 1)

  if (!cards.has(nodeId)) {
    const nodeInfo = resolveNodeInfo(nodeId)
    cards.set(nodeId, {
      id: `exec-${nodeId}`,
      title: e.node_type,
      nodeId,
      nodeTitle: nodeInfo.title,
      graphNodeId: nodeInfo.graphNodeId,
      isSubgraphNode: isNodeExecutionId(nodeId),
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
  t: (key: string) => string
): ErrorGroup[] {
  const groupsMap = new Map<string, GroupEntry>()

  processPromptError(groupsMap, executionStore, t)
  processNodeErrors(groupsMap, executionStore)
  processExecutionError(groupsMap, executionStore)

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

  const errorGroups = computed<ErrorGroup[]>(() =>
    buildErrorGroups(executionStore, t)
  )

  const filteredGroups = computed<ErrorGroup[]>(() => {
    const query = searchQuery.value.trim()
    return searchErrorGroups(errorGroups.value, query)
  })

  return {
    errorGroups,
    filteredGroups
  }
}
