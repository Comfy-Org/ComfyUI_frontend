<template>
  <div class="flex min-w-0 flex-col">
    <!-- Search bar + collapse toggle -->
    <div
      class="flex min-w-0 shrink-0 items-center border-b border-interface-stroke px-4 pt-1 pb-4"
    >
      <AsyncSearchInput v-model="searchQuery" class="flex-1" />
      <CollapseToggleButton
        v-model="isAllCollapsed"
        :show="!isSearching && allErrorGroups.length > 1"
      />
    </div>

    <div class="min-w-0 flex-1 overflow-y-auto bg-interface-panel-surface p-3">
      <div
        v-if="filteredGroups.length === 0"
        role="status"
        class="px-1 pt-5 pb-15 text-center text-sm text-muted-foreground"
      >
        {{
          searchQuery.trim()
            ? t('rightSidePanel.noneSearchDesc')
            : t('rightSidePanel.noErrors')
        }}
      </div>

      <div
        v-else
        class="overflow-hidden rounded-lg border border-secondary-background"
      >
        <!-- Errors summary hero -->
        <div
          data-testid="errors-summary-hero"
          class="flex items-center gap-2 bg-base-foreground/5 p-2"
        >
          <span
            class="flex h-12 min-w-9 shrink-0 items-center justify-center px-1 text-[2rem]/none font-extrabold text-destructive-background-hover tabular-nums"
          >
            {{ totalErrorCount }}
          </span>
          <span
            aria-hidden="true"
            class="h-9 w-px shrink-0 bg-interface-stroke"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-1 px-2">
            <span class="text-xs/tight font-semibold text-base-foreground">
              {{ t('rightSidePanel.errorsDetected', totalErrorCount) }}
            </span>
            <span class="text-xs/tight text-muted-foreground">
              {{ t('rightSidePanel.resolveBeforeRun') }}
            </span>
          </div>
        </div>

        <!-- Context strip: workflow summary, or the selection's errors -->
        <div
          data-testid="selection-context-strip"
          role="status"
          class="flex items-center border-t border-secondary-background px-3 pt-3.5 pb-1.5"
        >
          <i18n-t
            :keypath="strip.keypath"
            :plural="strip.count"
            tag="span"
            :class="
              cn(
                'min-w-0 flex-1 truncate text-xs font-semibold transition-colors duration-200',
                hasSelectionEmphasis
                  ? 'text-primary-background-hover'
                  : 'text-muted-foreground'
              )
            "
          >
            <template #node>{{ selectionStripNodeLabel }}</template>
            <template #nodes>{{ strip.nodes }}</template>
            <template #count>{{ strip.count }}</template>
          </i18n-t>
        </div>

        <!-- Group by Class Type -->
        <TransitionGroup tag="div" name="list-scale" class="relative">
          <ErrorCardSection
            v-for="group in filteredGroups"
            :key="group.groupKey"
            :data-testid="'error-group-' + group.type.replaceAll('_', '-')"
            :title="group.displayTitle"
            :count="group.count"
            :collapse="isSectionCollapsed(group.groupKey) && !isSearching"
            class="border-t border-secondary-background first:border-t-0"
            @update:collapse="setSectionCollapsed(group.groupKey, $event)"
          >
            <template #actions>
              <Button
                v-if="
                  group.type === 'missing_node' &&
                  missingNodePacks.length > 0 &&
                  shouldShowInstallButton
                "
                variant="secondary"
                size="sm"
                class="shrink-0"
                :disabled="isInstallingAll"
                @click.stop="installAll"
              >
                <DotSpinner v-if="isInstallingAll" duration="1s" :size="12" />
                {{
                  isInstallingAll
                    ? t('rightSidePanel.missingNodePacks.installing')
                    : t('rightSidePanel.missingNodePacks.installAll')
                }}
              </Button>
              <Button
                v-else-if="group.type === 'swap_nodes'"
                v-tooltip.top="
                  t(
                    'nodeReplacement.replaceAllWarning',
                    'Replaces all available nodes in this group.'
                  )
                "
                variant="secondary"
                size="sm"
                class="shrink-0"
                @click.stop="handleReplaceAll()"
              >
                {{ t('nodeReplacement.replaceAll', 'Replace All') }}
              </Button>
              <Button
                v-else-if="
                  group.type === 'missing_model' &&
                  showMissingModelHeaderRefresh
                "
                data-testid="missing-model-header-refresh"
                variant="muted-textonly"
                size="icon"
                class="shrink-0 rounded-lg hover:bg-transparent hover:text-base-foreground"
                :aria-label="t('rightSidePanel.missingModels.refresh')"
                :aria-busy="missingModelStore.isRefreshingMissingModels"
                :aria-disabled="missingModelStore.isRefreshingMissingModels"
                @click.stop="handleMissingModelRefresh"
              >
                <DotSpinner
                  v-if="missingModelStore.isRefreshingMissingModels"
                  aria-hidden="true"
                  duration="1s"
                  :size="12"
                />
                <i
                  v-else
                  aria-hidden="true"
                  class="icon-[lucide--refresh-cw] size-4 shrink-0"
                />
              </Button>
              <span
                v-if="
                  group.type === 'missing_model' &&
                  showMissingModelHeaderRefresh
                "
                role="status"
                aria-live="polite"
                class="sr-only"
              >
                {{
                  missingModelStore.isRefreshingMissingModels
                    ? t('rightSidePanel.missingModels.refreshing')
                    : ''
                }}
              </span>
            </template>

            <div
              v-if="group.displayMessage"
              data-testid="error-group-display-message"
              class="px-3 py-1"
            >
              <p
                class="m-0 text-xs/normal wrap-break-word whitespace-pre-wrap text-base-foreground/50"
              >
                {{ group.displayMessage }}
              </p>
            </div>

            <!-- Missing Node Packs -->
            <MissingNodeCard
              v-if="group.type === 'missing_node'"
              :show-info-button="shouldShowManagerButtons"
              :missing-pack-groups="missingPackGroups"
              :highlighted-node-ids="selectionMatchedAssetNodeIds"
              @locate-node="handleLocateMissingNode"
              @open-manager-info="handleOpenManagerInfo"
            />

            <!-- Swap Nodes -->
            <SwapNodesCard
              v-if="group.type === 'swap_nodes'"
              :swap-node-groups="swapNodeGroups"
              :highlighted-node-ids="selectionMatchedAssetNodeIds"
              @locate-node="handleLocateMissingNode"
              @replace="handleReplaceGroup"
            />

            <!-- Execution Errors -->
            <div v-if="isExecutionItemListGroup(group)" class="px-3">
              <ul class="m-0 list-none space-y-1 p-0">
                <li
                  v-for="item in getExecutionItemList(group)"
                  :key="item.key"
                  :aria-current="
                    isCardInSelection(item.cardId) ? 'true' : undefined
                  "
                  :class="
                    cn(
                      'min-w-0',
                      selectionEmphasisClass(isCardInSelection(item.cardId))
                    )
                  "
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="flex min-w-0 flex-1 items-center gap-1">
                      <button
                        v-tooltip.top="{
                          value: item.displayDetails || undefined,
                          showDelay: 300
                        }"
                        type="button"
                        class="focus-visible:ring-ring m-0 inline max-w-full cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
                        @click="handleLocateNode(item.nodeId)"
                      >
                        {{ item.label }}
                      </button>
                      <Button
                        v-if="item.displayDetails"
                        variant="textonly"
                        size="icon-sm"
                        :class="
                          cn(
                            'size-6 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset',
                            isExecutionItemDetailExpanded(item.key) &&
                              'bg-secondary-background-selected text-base-foreground hover:bg-secondary-background-selected'
                          )
                        "
                        :aria-label="
                          t(
                            'rightSidePanel.infoFor',
                            { item: item.label },
                            { escapeParameter: false }
                          )
                        "
                        :aria-controls="getExecutionItemDetailId(item.key)"
                        :aria-expanded="isExecutionItemDetailExpanded(item.key)"
                        @click.stop="toggleExecutionItemDetail(item.key)"
                      >
                        <i class="icon-[lucide--info] size-3.5" />
                      </Button>
                    </span>
                    <Button
                      variant="textonly"
                      size="icon-sm"
                      class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
                      :aria-label="
                        t(
                          'rightSidePanel.locateNodeFor',
                          {
                            item: item.label
                          },
                          { escapeParameter: false }
                        )
                      "
                      @click.stop="handleLocateNode(item.nodeId)"
                    >
                      <i class="icon-[lucide--locate] size-4" />
                    </Button>
                  </div>
                  <TransitionCollapse>
                    <p
                      v-if="
                        item.displayDetails &&
                        isExecutionItemDetailExpanded(item.key)
                      "
                      :id="getExecutionItemDetailId(item.key)"
                      class="m-0 mt-0.5 pr-10 text-2xs/relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground"
                    >
                      {{ item.displayDetails }}
                    </p>
                  </TransitionCollapse>
                </li>
              </ul>
            </div>
            <div v-else-if="group.type === 'execution'" class="space-y-3 px-3">
              <ErrorNodeCard
                v-for="card in group.cards"
                :key="card.id"
                :card="card"
                :aria-current="isCardInSelection(card.id) ? 'true' : undefined"
                :class="
                  cn(
                    selectionEmphasisClass(isCardInSelection(card.id)),
                    isCardInSelection(card.id) && '-my-1 py-1'
                  )
                "
                @locate-node="handleLocateNode"
                @copy-to-clipboard="copyToClipboard"
              />
            </div>

            <!-- Missing Models -->
            <MissingModelCard
              v-if="group.type === 'missing_model'"
              :missing-model-groups="missingModelGroups"
              :highlighted-node-ids="selectionMatchedAssetNodeIds"
              @locate-model="handleLocateAssetNode"
            />

            <!-- Missing Media -->
            <MissingMediaCard
              v-if="group.type === 'missing_media'"
              :missing-media-groups="missingMediaGroups"
              :highlighted-node-ids="selectionMatchedAssetNodeIds"
              @locate-node="handleLocateAssetNode"
            />
          </ErrorCardSection>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@comfyorg/tailwind-utils'

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

import CollapseToggleButton from '../layout/CollapseToggleButton.vue'
import TransitionCollapse from '../layout/TransitionCollapse.vue'
import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import ErrorCardSection from './ErrorCardSection.vue'
import ErrorNodeCard from './ErrorNodeCard.vue'
import MissingNodeCard from './MissingNodeCard.vue'
import SwapNodesCard from '@/platform/nodeReplacement/components/SwapNodesCard.vue'
import MissingModelCard from '@/platform/missingModel/components/MissingModelCard.vue'
import MissingMediaCard from '@/platform/missingMedia/components/MissingMediaCard.vue'
import { isCloud } from '@/platform/distribution/types'
import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { useErrorGroups } from './useErrorGroups'
import type { SwapNodeGroup } from './useErrorGroups'
import type { ErrorGroup } from './types'
import { isExecutionItemListGroup } from './executionItemList'
import { selectionEmphasisClass } from './selectionEmphasis'
import { useNodeReplacement } from '@/platform/nodeReplacement/useNodeReplacement'

interface ExecutionItemListEntry {
  key: string
  cardId: string
  nodeId: string
  label: string
  displayDetails?: string
}

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const { focusNode } = useFocusNode()
const rightSidePanelStore = useRightSidePanelStore()
const missingModelStore = useMissingModelStore()
const { shouldShowManagerButtons, shouldShowInstallButton, openManager } =
  useManagerState()
const { missingNodePacks } = useMissingNodes()
const { isInstalling: isInstallingAll, installAllPacks: installAll } =
  usePackInstall(() => missingNodePacks.value)
const { replaceGroup, replaceAllGroups } = useNodeReplacement()

const searchQuery = ref('')
const expandedExecutionItemDetailKeys = ref(new Set<string>())
const isSearching = computed(() => searchQuery.value.trim() !== '')

function getExecutionItemList(group: ErrorGroup): ExecutionItemListEntry[] {
  if (group.type !== 'execution') return []

  const items: ExecutionItemListEntry[] = []
  for (const card of group.cards) {
    if (!card.nodeId) continue
    for (let idx = 0; idx < card.errors.length; idx++) {
      const error = card.errors[idx]
      const label = error.displayItemLabel
      if (!label) continue
      items.push({
        key: `${card.id}:${idx}`,
        cardId: card.id,
        nodeId: card.nodeId,
        label,
        displayDetails: error.displayDetails
      })
    }
  }
  return items.sort(compareExecutionItemListEntry)
}

function compareExecutionItemListEntry(
  a: ExecutionItemListEntry,
  b: ExecutionItemListEntry
) {
  return (
    a.nodeId.localeCompare(b.nodeId, undefined, { numeric: true }) ||
    a.label.localeCompare(b.label)
  )
}

function isExecutionItemDetailExpanded(key: string) {
  return expandedExecutionItemDetailKeys.value.has(key)
}

function toggleExecutionItemDetail(key: string) {
  const nextKeys = new Set(expandedExecutionItemDetailKeys.value)
  if (nextKeys.has(key)) {
    nextKeys.delete(key)
  } else {
    nextKeys.add(key)
  }
  expandedExecutionItemDetailKeys.value = nextKeys
}

function getExecutionItemDetailId(key: string) {
  return `execution-item-detail-${key}`
}

const {
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
} = useErrorGroups(searchQuery)

const totalErrorCount = computed(() =>
  filteredGroups.value.reduce((sum, group) => sum + group.count, 0)
)

const hasSelectionEmphasis = computed(
  () => hasSelection.value && selectionErrorCount.value > 0
)
const selectionStripNodeLabel = computed(
  () => selectedNodeTitle.value ?? t('g.untitled')
)

// The strip is a status line, not a view of the current filter — summary
// numbers are workflow-wide, never search-filtered.
const workflowErrorCount = computed(() =>
  allErrorGroups.value.reduce((sum, group) => sum + group.count, 0)
)

const strip = computed(() => {
  if (hasSelectionEmphasis.value) {
    return {
      keypath:
        selectedNodeCount.value === 1
          ? 'rightSidePanel.selectedNodeErrors'
          : 'rightSidePanel.selectedNodesErrors',
      nodes: selectedNodeCount.value,
      count: selectionErrorCount.value
    }
  }
  return {
    keypath:
      errorNodeCount.value === 0
        ? // Node-less errors (e.g. prompt-level) would read as "0 nodes"
          'rightSidePanel.errorsSummary'
        : errorNodeCount.value === 1
          ? 'rightSidePanel.errorNodeSummary'
          : 'rightSidePanel.errorNodesSummary',
    nodes: errorNodeCount.value,
    count: workflowErrorCount.value
  }
})

function isCardInSelection(cardId: string): boolean {
  return selectionMatchedCardIds.value.has(cardId)
}

/**
 * Dedupes the Set-valued computed (fresh reference per recompute) so the
 * emphasis watcher below only fires when the matched membership changes.
 */
const selectionEmphasisSignature = computed(() =>
  hasSelection.value
    ? Array.from(selectionMatchedGroupKeys.value).sort().join('\n')
    : ''
)

/**
 * Selection acts as emphasis, not a filter: expand the groups containing
 * the selected nodes' errors and collapse the rest. When the emphasis ends
 * (selection cleared or moved to a node without errors), re-expand all
 * groups so the tab reads as the workflow overview again.
 */
watch(
  selectionEmphasisSignature,
  (signature, previousSignature) => {
    if (!signature) {
      if (!previousSignature) return
      for (const groupKey of Object.keys(collapseState)) {
        setSectionCollapsed(groupKey, false)
      }
      return
    }
    const matchedKeys = selectionMatchedGroupKeys.value
    for (const group of allErrorGroups.value) {
      setSectionCollapsed(group.groupKey, !matchedKeys.has(group.groupKey))
    }
  },
  { immediate: true }
)

const showMissingModelHeaderRefresh = computed(
  () => !isCloud && missingModelGroups.value.length > 0
)

function handleMissingModelRefresh() {
  if (missingModelStore.isRefreshingMissingModels) return

  void missingModelStore.refreshMissingModels()
}

const isAllCollapsed = computed({
  get() {
    return filteredGroups.value.every((g) => isSectionCollapsed(g.groupKey))
  },
  set(collapse: boolean) {
    for (const group of allErrorGroups.value) {
      setSectionCollapsed(group.groupKey, collapse)
    }
  }
})

function isSectionCollapsed(groupKey: string): boolean {
  // Defaults to expanded when not explicitly set by the user
  return collapseState[groupKey] ?? false
}

function setSectionCollapsed(groupKey: string, collapsed: boolean) {
  collapseState[groupKey] = collapsed
}

/**
 * When an external trigger (e.g. "See Error" button in SectionWidgets)
 * sets focusedErrorNodeId, expand only the group containing the target
 * node and collapse all others so the user sees the relevant errors
 * immediately.
 */
watch(
  () => rightSidePanelStore.focusedErrorNodeId,
  (graphNodeId) => {
    if (!graphNodeId) return
    const prefix = `${graphNodeId}:`
    for (const group of allErrorGroups.value) {
      if (group.type !== 'execution') continue

      const hasMatch = group.cards.some(
        (card) =>
          card.graphNodeId === graphNodeId ||
          (card.nodeId?.startsWith(prefix) ?? false)
      )
      setSectionCollapsed(group.groupKey, !hasMatch)
    }
    rightSidePanelStore.focusedErrorNodeId = null
  },
  { immediate: true }
)

function handleLocateNode(nodeId: string) {
  focusNode(nodeId, errorNodeCache.value)
}

function handleLocateMissingNode(nodeId: string) {
  focusNode(nodeId, missingNodeCache.value)
}

function handleLocateAssetNode(nodeId: string) {
  focusNode(nodeId)
}

function handleOpenManagerInfo(packId: string) {
  const isKnownToRegistry = missingNodePacks.value.some((p) => p.id === packId)
  if (isKnownToRegistry) {
    openManager({ initialTab: ManagerTab.Missing, initialPackId: packId })
  } else {
    openManager({ initialTab: ManagerTab.All, initialPackId: packId })
  }
}

function handleReplaceGroup(group: SwapNodeGroup) {
  replaceGroup(group)
}

function handleReplaceAll() {
  replaceAllGroups(swapNodeGroups.value)
}
</script>
