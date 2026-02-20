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
              @locate-node="focusNode"
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
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import { useExternalLink } from '@/composables/useExternalLink'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { NodeBadgeMode } from '@/types/nodeSource'

import PropertiesAccordionItem from '../layout/PropertiesAccordionItem.vue'
import FormSearchInput from '@/renderer/extensions/vueNodes/widgets/components/form/FormSearchInput.vue'
import ErrorNodeCard from './ErrorNodeCard.vue'
import Button from '@/components/ui/button/Button.vue'
import { useErrorGroups } from './useErrorGroups'

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const { focusNode, enterSubgraph } = useFocusNode()
const { staticUrls } = useExternalLink()
const rightSidePanelStore = useRightSidePanelStore()

const searchQuery = ref('')
const settingStore = useSettingStore()

const showNodeIdBadge = computed(
  () =>
    (settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode) !==
    NodeBadgeMode.None
)

const { filteredGroups } = useErrorGroups(searchQuery, t)

const collapseState = reactive<Record<string, boolean>>({})

watch(
  () => rightSidePanelStore.focusedErrorNodeId,
  (graphNodeId) => {
    if (!graphNodeId) return
    for (const group of filteredGroups.value) {
      const hasMatch = group.cards.some(
        (card) => card.graphNodeId === graphNodeId
      )
      collapseState[group.title] = !hasMatch
    }
    rightSidePanelStore.focusedErrorNodeId = null
  },
  { immediate: true }
)

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
  await useCommandStore().execute('Comfy.ContactSupport')
}
</script>
