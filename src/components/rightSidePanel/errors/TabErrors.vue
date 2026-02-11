<script setup lang="ts">
/**
 * TabErrors.vue
 *
 * This component displays all errors (prompt-level, node-specific, and runtime execution errors)
 * in a unified, searchable, and grouped view within the Right Side Panel.
 */

import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useExecutionStore } from '@/stores/executionStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { app } from '@/scripts/app'
import { Subgraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { useLitegraphService } from '@/services/litegraphService'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { NodeBadgeMode } from '@/types/nodeSource'

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
const { copyToClipboard: globalCopy } = useCopyToClipboard()

const searchQuery = ref('')
const settingStore = useSettingStore()

/** Whether to show node ID badges, based on the user's LiteGraph Node ID Badge Mode setting */
const showNodeIdBadge = computed(
  () =>
    (settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode) !==
    NodeBadgeMode.None
)

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolves the display title for a node given its execution ID.
 * @param nodeId The execution ID of the node.
 */
function resolveNodeTitle(nodeId: string): string {
  const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)
  return graphNode?.title || ''
}

/**
 * Checks if a given node ID belongs to a subgraph (contains a colon).
 * @param nodeId The ID to check.
 */
function isSubgraphId(nodeId: string): boolean {
  return nodeId.includes(':')
}

// ─── Normalisation ──────────────────────────────────────────────────────────

/**
 * Aggregates and normalises errors from executionStore into a hierarchy of groups and cards.
 * Organizes by: Group (class_type) -> Card (nodeId) -> Errors (list of items).
 */
const errorGroups = computed<ErrorGroup[]>(() => {
  const groupsMap = new Map<
    string,
    { priority: number; cards: Map<string, ErrorCardData> }
  >()

  const getOrCreateGroup = (title: string, priority = 1) => {
    if (!groupsMap.has(title)) {
      groupsMap.set(title, { priority, cards: new Map() })
    }
    return groupsMap.get(title)!.cards
  }

  // 1. Prompt-level error (no node IDs)
  if (executionStore.lastPromptError) {
    const error = executionStore.lastPromptError
    const groupTitle = error.message
    const group = getOrCreateGroup(groupTitle, 0) // Highest priority
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

  // 2. Node validation errors (400 Bad Request)
  if (executionStore.lastNodeErrors) {
    for (const [nodeId, nodeError] of Object.entries(
      executionStore.lastNodeErrors
    )) {
      const group = getOrCreateGroup(nodeError.class_type, 1)
      if (!group.has(nodeId)) {
        group.set(nodeId, {
          id: `node-${nodeId}`,
          title: nodeError.class_type,
          nodeId,
          nodeTitle: resolveNodeTitle(nodeId),
          isSubgraphNode: isSubgraphId(nodeId),
          errors: []
        })
      }
      const card = group.get(nodeId)!
      card.errors.push(
        ...nodeError.errors.map((e) => ({
          message: e.message,
          details: e.details ?? undefined
        }))
      )
    }
  }

  // 3. Runtime execution error (WebSocket)
  if (executionStore.lastExecutionError) {
    const e = executionStore.lastExecutionError
    const nodeId = String(e.node_id)
    const group = getOrCreateGroup(e.node_type, 1)

    if (!group.has(nodeId)) {
      group.set(nodeId, {
        id: `exec-${nodeId}`,
        title: e.node_type,
        nodeId,
        nodeTitle: resolveNodeTitle(nodeId),
        isSubgraphNode: isSubgraphId(nodeId),
        errors: []
      })
    }
    const card = group.get(nodeId)!
    card.errors.push({
      message: `${e.exception_type}: ${e.exception_message}`,
      details: e.traceback.join('\n'),
      isRuntimeError: true
    })
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

/**
 * Filtered version of errorGroups based on the searchQuery.
 * Searches across category names, node titles, IDs, and error messages.
 */
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

const collapseState = reactive<Record<string, boolean>>({})

// ─── Actions ────────────────────────────────────────────────────────────────

async function copyToClipboard(text: string) {
  try {
    await globalCopy(text)
  } catch (err) {
    console.error('Failed to copy error details to clipboard:', err)
  }
}

/**
 * Navigates the canvas to a specific graph or subgraph.
 *
 * NOTE: requestAnimationFrame is called twice consecutively to ensure the canvas
 * has completed its internal coordinate adjustments and DOM updates before
 * we attempt to center or focus on a specific node bounding box. This is
 * required due to the asynchronous nature of LiteGraph's subgraph switching.
 *
 * @param targetGraph The graph to navigate to.
 */
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

/**
 * Locates a specific node on the canvas and focuses on it.
 * Navigates to the appropriate subgraph if necessary.
 * @param nodeId The execution ID of the node to locate.
 */
async function locateNode(nodeId: string) {
  if (!canvasStore.canvas) return

  const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)
  if (!graphNode?.graph) return

  await navigateToGraph(graphNode.graph as LGraph)
  canvasStore.canvas?.animateToBounds(graphNode.boundingRect)
}

/**
 * Enters the subgraph associated with a node.
 * @param nodeId The execution ID of the node.
 */
async function enterSubgraph(nodeId: string) {
  if (!canvasStore.canvas) return

  const graphNode = getNodeByExecutionId(app.rootGraph, nodeId)
  if (!graphNode?.graph) return

  await navigateToGraph(graphNode.graph as LGraph)
  useLitegraphService().fitView()
}

// ─── Help Links ─────────────────────────────────────────────────────────────

const REPO_OWNER = 'comfyanonymous'
const REPO_NAME = 'ComfyUI'

/**
 * Open GitHub issues search filtered by the current errors.
 * Uses the same URL pattern as the existing FindIssueButton component.
 */
function openGitHubIssues() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'error_tab_github_issues_clicked'
  })
  const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Open contact support flow using the existing Comfy.ContactSupport command.
 */
async function contactSupport() {
  useTelemetry()?.trackHelpResourceClicked({
    resource_type: 'help_feedback',
    is_external: true,
    source: 'error_dialog'
  })
  await useCommandStore().execute('Comfy.ContactSupport')
}
</script>

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
              @locate-node="locateNode"
              @enter-subgraph="enterSubgraph"
              @copy-to-clipboard="copyToClipboard"
            />
          </div>
        </PropertiesAccordionItem>
      </div>
    </div>

    <!-- Fixed Footer: Help Links -->
    <div class="shrink-0 border-t border-interface-stroke px-4 py-4 min-w-0">
      <p class="m-0 text-sm text-muted-foreground leading-tight break-words">
        {{ t('rightSidePanel.errorHelpPrefix') }}
        <Button
          variant="textonly"
          size="unset"
          class="inline underline text-inherit text-sm whitespace-nowrap"
          @click="openGitHubIssues"
        >
          {{ t('rightSidePanel.errorHelpGithub') }}
        </Button>
        {{ t('rightSidePanel.errorHelpOr') }}
        <Button
          variant="textonly"
          size="unset"
          class="inline underline text-inherit text-sm whitespace-nowrap"
          @click="contactSupport"
        >
          {{ t('rightSidePanel.errorHelpSupport') }}
        </Button>.
      </p>
    </div>
  </div>
</template>
