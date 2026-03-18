<template>
  <div class="flex h-full min-w-0 flex-col">
    <!-- Search bar + collapse toggle -->
    <div
      class="flex min-w-0 shrink-0 items-center border-b border-interface-stroke px-4 pt-1 pb-4"
    >
      <FormSearchInput v-model="searchQuery" class="flex-1" />
      <CollapseToggleButton
        v-model="isAllCollapsed"
        :show="!isSearching && tabErrorGroups.length > 1"
      />
    </div>

    <!-- Runtime error: full-height panel outside accordion -->
    <div
      v-if="singleRuntimeErrorCard"
      data-testid="runtime-error-panel"
      class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3"
    >
      <div
        class="shrink-0 pb-2 text-sm font-semibold text-destructive-background-hover"
      >
        {{ singleRuntimeErrorGroup?.title }}
      </div>
      <ErrorNodeCard
        :key="singleRuntimeErrorCard.id"
        :card="singleRuntimeErrorCard"
        :show-node-id-badge="showNodeIdBadge"
        full-height
        class="min-h-0 flex-1"
        @locate-node="handleLocateNode"
        @enter-subgraph="handleEnterSubgraph"
        @copy-to-clipboard="copyToClipboard"
      />
    </div>

    <!-- Scrollable content (non-runtime or mixed errors) -->
    <div v-else class="min-w-0 flex-1 overflow-y-auto" aria-live="polite">
      <TransitionGroup tag="div" name="list-scale" class="relative">
        <div
          v-if="filteredGroups.length === 0"
          key="empty"
          class="px-4 pt-5 pb-15 text-center text-sm text-muted-foreground"
        >
          {{
            searchQuery.trim()
              ? t('rightSidePanel.noneSearchDesc')
              : t('rightSidePanel.noErrors')
          }}
        </div>

        <!-- Group by Class Type -->
        <PropertiesAccordionItem
          v-for="group in filteredGroups"
          :key="group.title"
          :data-testid="'error-group-' + group.type.replace('_', '-')"
          :collapse="isSectionCollapsed(group.title) && !isSearching"
          class="border-b border-interface-stroke"
          :size="getGroupSize(group)"
          @update:collapse="setSectionCollapsed(group.title, $event)"
        >
          <template #label>
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <span class="flex min-w-0 flex-1 items-center gap-2">
                <i
                  class="icon-[lucide--octagon-alert] size-4 shrink-0 text-destructive-background-hover"
                />
                <span class="truncate text-destructive-background-hover">
                  {{
                    group.type === 'missing_node'
                      ? `${group.title} (${missingPackGroups.length})`
                      : group.type === 'swap_nodes'
                        ? `${group.title} (${swapNodeGroups.length})`
                        : group.title
                  }}
                </span>
                <span
                  v-if="group.type === 'execution' && group.cards.length > 1"
                  class="text-destructive-background-hover"
                >
                  ({{ group.cards.length }})
                </span>
              </span>
              <Button
                v-if="
                  group.type === 'missing_node' &&
                  missingNodePacks.length > 0 &&
                  shouldShowInstallButton
                "
                variant="secondary"
                size="sm"
                class="mr-2 h-8 shrink-0 rounded-lg text-sm"
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
                v-else-if="
                  group.type === 'missing_model' &&
                  downloadableModels.length > 0
                "
                variant="secondary"
                size="sm"
                class="mr-2 h-8 shrink-0 rounded-lg text-sm"
                @click.stop="downloadAllModels"
              >
                {{ downloadAllLabel }}
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
                class="mr-2 h-8 shrink-0 rounded-lg text-sm"
                @click.stop="handleReplaceAll()"
              >
                {{ t('nodeReplacement.replaceAll', 'Replace All') }}
              </Button>
            </div>
          </template>

          <!-- Missing Node Packs -->
          <MissingNodeCard
            v-if="group.type === 'missing_node'"
            :show-info-button="shouldShowManagerButtons"
            :show-node-id-badge="showNodeIdBadge"
            :missing-pack-groups="missingPackGroups"
            @locate-node="handleLocateMissingNode"
            @open-manager-info="handleOpenManagerInfo"
          />

          <!-- Swap Nodes -->
          <SwapNodesCard
            v-else-if="group.type === 'swap_nodes'"
            :swap-node-groups="swapNodeGroups"
            :show-node-id-badge="showNodeIdBadge"
            @locate-node="handleLocateMissingNode"
            @replace="handleReplaceGroup"
          />

          <!-- Execution Errors -->
          <div v-else-if="group.type === 'execution'" class="space-y-3 px-4">
            <ErrorNodeCard
              v-for="card in group.cards"
              :key="card.id"
              :card="card"
              :show-node-id-badge="showNodeIdBadge"
              :compact="isSingleNodeSelected"
              @locate-node="handleLocateNode"
              @enter-subgraph="handleEnterSubgraph"
              @copy-to-clipboard="copyToClipboard"
            />
          </div>

          <!-- Missing Models -->
          <MissingModelCard
            v-else-if="group.type === 'missing_model'"
            :missing-model-groups="missingModelGroups"
            :show-node-id-badge="showNodeIdBadge"
            @locate-model="handleLocateModel"
          />
        </PropertiesAccordionItem>
      </TransitionGroup>
    </div>

    <!-- Fixed Footer: Help Links -->
    <div class="min-w-0 shrink-0 border-t border-interface-stroke p-4">
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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { useExternalLink } from '@/composables/useExternalLink'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { NodeBadgeMode } from '@/types/nodeSource'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import CollapseToggleButton from '../layout/CollapseToggleButton.vue'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'
import ErrorNodeCard from './ErrorNodeCard.vue'
import MissingNodeCard from './MissingNodeCard.vue'
import SwapNodesCard from '@/platform/nodeReplacement/components/SwapNodesCard.vue'
import MissingModelCard from '@/platform/missingModel/components/MissingModelCard.vue'
import { isCloud } from '@/platform/distribution/types'
import {
  downloadModel,
  isModelDownloadable
} from '@/platform/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { formatSize } from '@/utils/formatUtil'
import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { useErrorGroups } from './useErrorGroups'
import type { SwapNodeGroup } from './useErrorGroups'
import type { ErrorGroup } from './types'
import { useNodeReplacement } from '@/platform/nodeReplacement/useNodeReplacement'

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const { focusNode, enterSubgraph } = useFocusNode()
const { staticUrls } = useExternalLink()
const settingStore = useSettingStore()
const rightSidePanelStore = useRightSidePanelStore()
const { shouldShowManagerButtons, shouldShowInstallButton, openManager } =
  useManagerState()
const { missingNodePacks } = useMissingNodes()
const { isInstalling: isInstallingAll, installAllPacks: installAll } =
  usePackInstall(() => missingNodePacks.value)
const { replaceGroup, replaceAllGroups } = useNodeReplacement()

const searchQuery = ref('')
const isSearching = computed(() => searchQuery.value.trim() !== '')

const fullSizeGroupTypes = new Set([
  'missing_node',
  'swap_nodes',
  'missing_model'
])
function getGroupSize(group: ErrorGroup) {
  return fullSizeGroupTypes.has(group.type) ? 'lg' : 'default'
}

const showNodeIdBadge = computed(
  () =>
    (settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode) !==
    NodeBadgeMode.None
)

const {
  allErrorGroups,
  tabErrorGroups,
  filteredGroups,
  collapseState,
  isSingleNodeSelected,
  errorNodeCache,
  missingNodeCache,
  missingPackGroups,
  missingModelGroups,
  swapNodeGroups
} = useErrorGroups(searchQuery, t)

const singleRuntimeErrorGroup = computed(() => {
  if (filteredGroups.value.length !== 1) return null
  const group = filteredGroups.value[0]
  const isSoleRuntimeError =
    group.type === 'execution' &&
    group.cards.length === 1 &&
    group.cards[0].errors.every((e) => e.isRuntimeError)
  return isSoleRuntimeError ? group : null
})

const singleRuntimeErrorCard = computed(
  () => singleRuntimeErrorGroup.value?.cards[0] ?? null
)

const missingModelStore = useMissingModelStore()

const downloadableModels = computed(() => {
  if (isCloud) return []
  return missingModelGroups.value.flatMap((group) =>
    group.models
      .filter(
        (m) =>
          m.representative.url &&
          m.representative.directory &&
          isModelDownloadable({
            name: m.representative.name,
            url: m.representative.url,
            directory: m.representative.directory
          })
      )
      .map((m) => ({
        name: m.representative.name,
        url: m.representative.url!,
        directory: m.representative.directory!
      }))
  )
})

const downloadAllLabel = computed(() => {
  const base = t('rightSidePanel.missingModels.downloadAll')
  const total = downloadableModels.value.reduce(
    (sum, m) => sum + (missingModelStore.fileSizes[m.url] ?? 0),
    0
  )
  return total > 0 ? `${base} (${formatSize(total)})` : base
})

function downloadAllModels() {
  for (const model of downloadableModels.value) {
    downloadModel(model, missingModelStore.folderPaths)
  }
}

const isAllCollapsed = computed({
  get() {
    return filteredGroups.value.every((g) => isSectionCollapsed(g.title))
  },
  set(collapse: boolean) {
    for (const group of tabErrorGroups.value) {
      setSectionCollapsed(group.title, collapse)
    }
  }
})

function isSectionCollapsed(title: string): boolean {
  // Defaults to expanded when not explicitly set by the user
  return collapseState[title] ?? false
}

function setSectionCollapsed(title: string, collapsed: boolean) {
  collapseState[title] = collapsed
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
      const hasMatch =
        group.type === 'execution' &&
        group.cards.some(
          (card) =>
            card.graphNodeId === graphNodeId ||
            (card.nodeId?.startsWith(prefix) ?? false)
        )
      setSectionCollapsed(group.title, !hasMatch)
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

function handleLocateModel(nodeId: string) {
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

function openGitHubIssues() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'error_tab_github_issues_clicked'
  })
  window.open(staticUrls.githubIssues, '_blank', 'noopener,noreferrer')
}

async function contactSupport() {
  useTelemetry()?.trackHelpResourceClicked({
    resource_type: 'help_feedback',
    is_external: true,
    source: 'error_dialog'
  })
  useCommandStore().execute('Comfy.ContactSupport')
}
</script>
