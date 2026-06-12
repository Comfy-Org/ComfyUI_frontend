<template>
  <div class="flex h-full min-w-0 flex-col">
    <!-- Search bar + collapse toggle -->
    <div
      class="flex min-w-0 shrink-0 items-center border-b border-interface-stroke px-4 pt-1 pb-4"
    >
      <AsyncSearchInput v-model="searchQuery" class="flex-1" />
      <CollapseToggleButton
        v-model="isAllCollapsed"
        :show="!isSearching && tabErrorGroups.length > 1"
      />
    </div>

    <div
      class="min-w-0 flex-1 overflow-y-auto bg-interface-panel-surface p-3"
      aria-live="polite"
    >
      <div
        v-if="filteredGroups.length === 0"
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

        <!-- Group by Class Type -->
        <TransitionGroup tag="div" name="list-scale" class="relative">
          <ErrorCardSection
            v-for="group in filteredGroups"
            :key="group.groupKey"
            :data-testid="'error-group-' + group.type.replaceAll('_', '-')"
            :title="group.displayTitle"
            :count="getGroupCount(group)"
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
              @locate-node="handleLocateMissingNode"
              @open-manager-info="handleOpenManagerInfo"
            />

            <!-- Swap Nodes -->
            <SwapNodesCard
              v-if="group.type === 'swap_nodes'"
              :swap-node-groups="swapNodeGroups"
              @locate-node="handleLocateMissingNode"
              @replace="handleReplaceGroup"
            />

            <!-- Execution Errors -->
            <div v-if="isExecutionItemListGroup(group)" class="px-3">
              <ul class="m-0 list-none space-y-1 p-0">
                <li
                  v-for="item in getExecutionItemList(group)"
                  :key="item.key"
                  class="min-w-0"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="flex min-w-0 flex-1 items-center gap-1">
                      <button
                        v-tooltip.top="{
                          value: item.displayDetails || undefined,
                          showDelay: 300
                        }"
                        type="button"
                        class="m-0 inline max-w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-xs/relaxed font-normal wrap-break-word text-muted-foreground outline-none hover:text-base-foreground focus:outline-none focus-visible:underline focus-visible:ring-0 focus-visible:outline-none"
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
                            'size-6 shrink-0 text-muted-foreground hover:text-base-foreground',
                            isExecutionItemDetailExpanded(item.key) &&
                              'bg-secondary-background-selected text-base-foreground hover:bg-secondary-background-selected'
                          )
                        "
                        :aria-label="
                          t('rightSidePanel.infoFor', { item: item.label })
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
                      class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
                      :aria-label="
                        t('rightSidePanel.locateNodeFor', { item: item.label })
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
                :compact="isSingleNodeSelected"
                @locate-node="handleLocateNode"
                @enter-subgraph="handleEnterSubgraph"
                @copy-to-clipboard="copyToClipboard"
              />
            </div>

            <!-- Missing Models -->
            <MissingModelCard
              v-if="group.type === 'missing_model'"
              :missing-model-groups="missingModelGroups"
              @locate-model="handleLocateAssetNode"
            />

            <!-- Missing Media -->
            <MissingMediaCard
              v-if="group.type === 'missing_media'"
              :missing-media-groups="missingMediaGroups"
              @locate-node="handleLocateAssetNode"
            />
          </ErrorCardSection>
        </TransitionGroup>
      </div>
    </div>

    <ErrorPanelSurveyCta v-if="ErrorPanelSurveyCta" />

    <!-- Fixed Footer: Help Links -->
    <div
      class="min-w-0 shrink-0 border-t border-interface-stroke bg-interface-panel-surface p-4"
    >
      <i18n-t
        keypath="rightSidePanel.errorHelp"
        tag="p"
        class="m-0 text-sm/tight wrap-break-word text-muted-foreground"
      >
        <template #github>
          <Button
            variant="textonly"
            size="unset"
            class="inline text-sm whitespace-nowrap text-inherit underline"
            @click="openGitHubIssues"
          >
            {{ t('rightSidePanel.errorHelpGithub') }}
          </Button>
        </template>
        <template #support>
          <Button
            variant="textonly"
            size="unset"
            class="inline text-sm whitespace-nowrap text-inherit underline"
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
import { computed, defineAsyncComponent, ref, watch } from 'vue'
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
import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'
import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { useErrorActions } from './useErrorActions'
import { useErrorGroups } from './useErrorGroups'
import type { SwapNodeGroup } from './useErrorGroups'
import type { ErrorGroup } from './types'
import { useNodeReplacement } from '@/platform/nodeReplacement/useNodeReplacement'

interface ExecutionItemListEntry {
  key: string
  nodeId: string
  label: string
  displayDetails?: string
}

const ErrorPanelSurveyCta =
  isNightly && !isCloud && !isDesktop
    ? defineAsyncComponent(
        () => import('@/platform/surveys/ErrorPanelSurveyCta.vue')
      )
    : undefined

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const { focusNode, enterSubgraph } = useFocusNode()
const { openGitHubIssues, contactSupport } = useErrorActions()
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

function isExecutionItemListGroup(group: ErrorGroup) {
  return (
    group.type === 'execution' &&
    group.cards.length > 0 &&
    group.cards.every(
      (card) =>
        card.nodeId &&
        card.errors.length > 0 &&
        card.errors.every(
          (error) => !error.isRuntimeError && Boolean(error.displayItemLabel)
        )
    )
  )
}

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

function getExecutionGroupCount(group: ErrorGroup) {
  if (group.type !== 'execution') return 0
  if (isExecutionItemListGroup(group)) {
    return group.cards.reduce((count, card) => count + card.errors.length, 0)
  }
  return group.cards.length
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
  tabErrorGroups,
  filteredGroups,
  collapseState,
  isSingleNodeSelected,
  errorNodeCache,
  missingNodeCache,
  missingPackGroups,
  filteredMissingModelGroups: missingModelGroups,
  filteredMissingMediaGroups: missingMediaGroups,
  swapNodeGroups
} = useErrorGroups(searchQuery)

function getGroupCount(group: ErrorGroup): number {
  switch (group.type) {
    case 'execution':
      return getExecutionGroupCount(group)
    case 'missing_node':
      return missingPackGroups.value.length
    case 'swap_nodes':
      return swapNodeGroups.value.length
    case 'missing_model':
      return missingModelGroups.value.length
    case 'missing_media':
      return missingMediaGroups.value.length
  }
}

const totalErrorCount = computed(() =>
  filteredGroups.value.reduce((sum, group) => sum + getGroupCount(group), 0)
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
    for (const group of tabErrorGroups.value) {
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

function handleEnterSubgraph(nodeId: string) {
  enterSubgraph(nodeId, errorNodeCache.value)
}
</script>
