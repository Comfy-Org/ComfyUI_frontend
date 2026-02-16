<template>
  <div class="flex flex-col h-full min-w-0">
    <!-- Search bar -->
    <div
      class="px-4 pt-1 pb-4 flex gap-2 border-b border-interface-stroke shrink-0 min-w-0"
    >
      <FormSearchInput v-model="searchQuery" />
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto min-w-0">
      <div
        v-if="filteredGroups.length === 0"
        class="text-sm text-muted-foreground px-4 text-center pt-5 pb-15"
      >
        {{
          searchQuery.trim()
            ? t('rightSidePanel.noneSearchDesc')
            : t('rightSidePanel.noErrors')
        }}
      </div>

      <div v-else>
        <!-- Group by Class Type -->
        <PropertiesAccordionItem
          v-for="group in filteredGroups"
          :key="group.title"
          :collapse="collapseState[group.title] ?? false"
          class="border-b border-interface-stroke"
          @update:collapse="collapseState[group.title] = $event"
        >
          <template #label>
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="flex-1 flex items-center gap-2 min-w-0">
                <i
                  class="icon-[lucide--octagon-alert] size-4 text-destructive-background-hover shrink-0"
                />
                <span class="text-destructive-background-hover truncate">
                  {{ group.title }}
                </span>
                <span
                  v-if="group.cards.length > 1"
                  class="text-destructive-background-hover"
                >
                  ({{ group.cards.length }})
                </span>
              </span>
            </div>
          </template>

          <!-- Cards in Group (default slot) -->
          <div class="px-4 space-y-3">
            <ErrorNodeCard
              v-for="card in group.cards"
              :key="card.id"
              :card="card"
              :show-node-id-badge="showNodeIdBadge"
              :compact="isSingleNodeSelected"
              @locate-node="locateNode"
              @enter-subgraph="enterSubgraph"
              @copy-to-clipboard="copyToClipboard"
            />
          </div>
        </PropertiesAccordionItem>
      </div>
    </div>

    <!-- Fixed Footer: Help Links -->
    <div class="shrink-0 border-t border-interface-stroke p-4 min-w-0">
      <i18n-t
        keypath="rightSidePanel.errorHelp"
        tag="p"
        class="m-0 text-sm text-muted-foreground leading-tight break-words"
      >
        <template #github>
          <Button
            variant="textonly"
            size="unset"
            class="inline underline text-inherit text-sm whitespace-nowrap"
            @click="openGitHubIssues"
          >
            {{ t('rightSidePanel.errorHelpGithub') }}
          </Button>
        </template>
        <template #support>
          <Button
            variant="textonly"
            size="unset"
            class="inline underline text-inherit text-sm whitespace-nowrap"
            @click="contactSupport"
          >
            {{ t('rightSidePanel.errorHelpSupport') }}
          </Button>
        </template>
      </i18n-t>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { app } from '@/scripts/app'
import { Subgraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { useLitegraphService } from '@/services/litegraphService'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useExternalLink } from '@/composables/useExternalLink'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { NodeBadgeMode } from '@/types/nodeSource'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { isGroupNode } from '@/utils/executableGroupNodeDto'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'
import ErrorNodeCard from './ErrorNodeCard.vue'
import Button from '@/components/ui/button/Button.vue'
import type { ErrorCardData, ErrorGroup } from './types'

/** Prompt error types that have predefined localized descriptions. */
const KNOWN_PROMPT_ERROR_TYPES = new Set(['prompt_no_outputs', 'no_prompt'])

const executionStore = useExecutionStore()
const canvasStore = useCanvasStore()
const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const { staticUrls } = useExternalLink()
const rightSidePanelStore = useRightSidePanelStore()
const settingStore = useSettingStore()

const searchQuery = ref('')
const collapseState = reactive<Record<string, boolean>>({})

/** Whether to show node ID badges, based on the user's LiteGraph Node ID Badge Mode setting */
const showNodeIdBadge = computed(
  () =>
    (settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode) !==
    NodeBadgeMode.None
)

/** Set of container node IDs (subgraph/group) among selected nodes */
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

const selectedGraphNodeIds = computed<Set<string> | null>(() => {
  const items = canvasStore.selectedItems
  if (items.length === 0) return null
  const nodes = items.filter(isLGraphNode)
  if (nodes.length === 0) return null
  return new Set(nodes.map((n) => String(n.id)))
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

function isSubgraphId(nodeId: string): boolean {
  return nodeId.includes(':')
}

function getParentNodeId(executionNodeId: string): string | null {
  const colonIndex = executionNodeId.indexOf(':')
  if (colonIndex === -1) return null
  return executionNodeId.slice(0, colonIndex)
}

function resolveNodeTitle(nodeId: string): string {
  const graphNode = executionIdToGraphNodeMap.value.get(nodeId)
  return graphNode?.title || ''
}

function isNodeSelected(executionNodeId: string): boolean {
  const nodeIds = selectedGraphNodeIds.value
  if (!nodeIds) return true

  const graphNode = executionIdToGraphNodeMap.value.get(executionNodeId)
  if (graphNode && nodeIds.has(String(graphNode.id))) return true

  for (const containerId of selectedContainerNodeIds.value) {
    if (executionNodeId.startsWith(`${containerId}:`)) return true
  }

  return false
}

function createErrorCard(
  id: string,
  title: string,
  nodeId: string,
  errors: ErrorCardData['errors']
): ErrorCardData {
  const parentId = getParentNodeId(nodeId)
  const parentNode = parentId
    ? app.rootGraph.getNodeById(Number(parentId))
    : null
  const isParentGroupNode = parentNode ? isGroupNode(parentNode) : false

  return {
    id,
    title,
    nodeId,
    nodeTitle: isParentGroupNode
      ? parentNode?.title || ''
      : resolveNodeTitle(nodeId),
    isSubgraphNode: isSubgraphId(nodeId) && !isParentGroupNode,
    errors
  }
}

function regroupByErrorMessage(
  groupsMap: Map<
    string,
    { priority: number; cards: Map<string, ErrorCardData> }
  >
): ErrorGroup[] {
  const allCards = Array.from(groupsMap.values()).flatMap((g) =>
    Array.from(g.cards.values())
  )
  const messageMap = new Map<
    string,
    { priority: number; cards: Map<string, ErrorCardData> }
  >()
  for (const card of allCards) {
    for (const error of card.errors) {
      const msgKey = error.message
      if (!messageMap.has(msgKey)) {
        messageMap.set(msgKey, { priority: 1, cards: new Map() })
        // Priority is unused in single-node mode (sorted by title only); hardcoded to satisfy ErrorGroup type
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

function processPromptError(
  getOrCreateGroup: (
    title: string,
    priority?: number
  ) => Map<string, ErrorCardData>
) {
  if (!selectedGraphNodeIds.value && executionStore.lastPromptError) {
    const error = executionStore.lastPromptError
    const groupTitle = error.message
    const group = getOrCreateGroup(groupTitle, 0)
    const isKnown = KNOWN_PROMPT_ERROR_TYPES.has(error.type)

    group.set('__prompt__', {
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
}

function processValidationErrors(
  getOrCreateGroup: (
    title: string,
    priority?: number
  ) => Map<string, ErrorCardData>,
  singleMode: boolean
) {
  if (executionStore.lastNodeErrors) {
    for (const [nodeId, nodeError] of Object.entries(
      executionStore.lastNodeErrors
    )) {
      if (!isNodeSelected(nodeId)) continue

      const groupKey = singleMode ? '__single__' : nodeError.class_type
      const group = getOrCreateGroup(groupKey, 1)

      if (!group.has(nodeId)) {
        group.set(
          nodeId,
          createErrorCard(`node-${nodeId}`, nodeError.class_type, nodeId, [])
        )
      }
      const card = group.get(nodeId)
      if (!card) continue
      card.errors.push(
        ...nodeError.errors.map((e) => ({
          message: e.message,
          details: e.details ?? undefined
        }))
      )
    }
  }
}

function processRuntimeError(
  getOrCreateGroup: (
    title: string,
    priority?: number
  ) => Map<string, ErrorCardData>,
  singleMode: boolean
) {
  if (executionStore.lastExecutionError) {
    const e = executionStore.lastExecutionError
    const nodeId = String(e.node_id)

    if (isNodeSelected(nodeId)) {
      const groupKey = singleMode ? '__single__' : e.node_type
      const group = getOrCreateGroup(groupKey, 1)

      if (!group.has(nodeId)) {
        group.set(
          nodeId,
          createErrorCard(`exec-${nodeId}`, e.node_type, nodeId, [])
        )
      }
      const card = group.get(nodeId)
      if (!card) return
      card.errors.push({
        message: `${e.exception_type}: ${e.exception_message}`,
        details: e.traceback.join('\n'),
        isRuntimeError: true
      })
    }
  }
}

const errorGroups = computed<ErrorGroup[]>(() => {
  const groupsMap = new Map<
    string,
    { priority: number; cards: Map<string, ErrorCardData> }
  >()

  const singleMode = isSingleNodeSelected.value

  const getOrCreateGroup = (title: string, priority = 1) => {
    let entry = groupsMap.get(title)
    if (!entry) {
      entry = { priority, cards: new Map() }
      groupsMap.set(title, entry)
    }
    return entry.cards
  }

  processPromptError(getOrCreateGroup)
  processValidationErrors(getOrCreateGroup, singleMode)
  processRuntimeError(getOrCreateGroup, singleMode)

  if (singleMode) {
    return regroupByErrorMessage(groupsMap)
  }

  // Convert map to sorted array (Priority first, then Title)
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
})

const filteredGroups = computed<ErrorGroup[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return errorGroups.value

  return errorGroups.value
    .map((group) => {
      const isHeaderMatch = group.title.toLowerCase().includes(query)
      const matchedCards = group.cards.filter(
        (card) =>
          isHeaderMatch ||
          card.nodeId?.toLowerCase().includes(query) ||
          card.nodeTitle?.toLowerCase().includes(query) ||
          card.errors.some(
            (e) =>
              e.message.toLowerCase().includes(query) ||
              e.details?.toLowerCase().includes(query)
          )
      )

      return { ...group, cards: matchedCards }
    })
    .filter((group) => group.cards.length > 0)
})

watch(
  () => rightSidePanelStore.focusedErrorNodeId,
  (graphNodeId) => {
    if (!graphNodeId) return
    const prefix = `${graphNodeId}:`
    for (const group of filteredGroups.value) {
      const hasMatch = group.cards.some((card) => {
        if (!card.nodeId) return false
        const graphNode = executionIdToGraphNodeMap.value.get(card.nodeId)
        if (graphNode && String(graphNode.id) === graphNodeId) return true
        return card.nodeId.startsWith(prefix)
      })
      collapseState[group.title] = !hasMatch
    }
    rightSidePanelStore.focusedErrorNodeId = null
  },
  { immediate: true }
)

// Double RAF is needed to wait for LiteGraph's internal canvas frame cycle
// after subgraph switching before we can focus on a node bounding box.
async function navigateToGraph(targetGraph: LGraph) {
  const canvas = canvasStore.canvas
  if (!canvas) return

  if (canvas.graph !== targetGraph) {
    canvas.subgraph =
      !targetGraph.isRootGraph && targetGraph instanceof Subgraph
        ? targetGraph
        : undefined
    canvas.setGraph(targetGraph)

    // Ensure DOM and graph state are synchronised
    await nextTick()

    // Double RAF to wait for LiteGraph's internal canvas frame cycle
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )
  }
}

async function locateNode(nodeId: string) {
  if (!canvasStore.canvas) return

  // For group node internals, locate the parent group node instead
  const parentId = getParentNodeId(nodeId)
  const parentNode = parentId
    ? app.rootGraph.getNodeById(Number(parentId))
    : null

  if (parentNode && isGroupNode(parentNode) && parentNode.graph) {
    await navigateToGraph(parentNode.graph as LGraph)
    canvasStore.canvas?.animateToBounds(parentNode.boundingRect)
    return
  }

  const graphNode = executionIdToGraphNodeMap.value.get(nodeId)
  if (!graphNode?.graph) return

  await navigateToGraph(graphNode.graph as LGraph)
  canvasStore.canvas?.animateToBounds(graphNode.boundingRect)
}

async function enterSubgraph(nodeId: string) {
  if (!canvasStore.canvas) return

  const graphNode = executionIdToGraphNodeMap.value.get(nodeId)
  if (!graphNode?.graph) return

  await navigateToGraph(graphNode.graph as LGraph)
  useLitegraphService().fitView()
}

function openGitHubIssues() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'error_tab_github_issues_clicked'
  })
  const url = staticUrls.githubIssues
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function contactSupport() {
  useTelemetry()?.trackHelpResourceClicked({
    resource_type: 'help_feedback',
    is_external: true,
    source: 'error_dialog'
  })
  try {
    await useCommandStore().execute('Comfy.ContactSupport')
  } catch (error) {
    console.error(error)
    useToastStore().addAlert(t('rightSidePanel.contactSupportFailed'))
  }
}
</script>
