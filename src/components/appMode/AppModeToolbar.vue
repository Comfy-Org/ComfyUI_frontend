<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowActionsDropdown from '@/components/common/WorkflowActionsDropdown.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import Button from '@/components/ui/button/Button.vue'
import { useAppMode } from '@/composables/useAppMode'
import { isCloud } from '@/platform/distribution/types'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { cn } from '@/utils/tailwindUtil'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const commandStore = useCommandStore()
const workspaceStore = useWorkspaceStore()
const { enableAppBuilder } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder } = appModeStore
const { toastErrorHandler } = useErrorHandling()
const { flags } = useFeatureFlags()
const { hasNodes } = storeToRefs(appModeStore)
const tooltipOptions = { showDelay: 300, hideDelay: 300 }

const isAssetsActive = computed(
  () => workspaceStore.sidebarTab.activeSidebarTab?.id === 'assets'
)
const isAppsActive = computed(
  () => workspaceStore.sidebarTab.activeSidebarTab?.id === 'apps'
)

function openAssets() {
  void commandStore.execute('Workspace.ToggleSidebarTab.assets')
}

function showApps() {
  void commandStore.execute('Workspace.ToggleSidebarTab.apps')
}
</script>

<template>
  <div class="pointer-events-auto flex flex-col gap-2">
    <WorkflowActionsDropdown source="app_mode_toolbar" />

    <Button
      v-if="enableAppBuilder"
      v-tooltip.right="{
        value: t('linearMode.appModeToolbar.appBuilder'),
        ...tooltipOptions
      }"
      variant="secondary"
      size="unset"
      :disabled="!hasNodes"
      :aria-label="t('linearMode.appModeToolbar.appBuilder')"
      class="size-10 rounded-lg"
      @click="enterBuilder"
    >
      <i class="icon-[lucide--hammer] size-4" />
    </Button>
    <Button
      v-if="isCloud && flags.workflowSharingEnabled"
      v-tooltip.right="{
        value: t('actionbar.shareTooltip'),
        ...tooltipOptions
      }"
      variant="secondary"
      size="unset"
      :aria-label="t('actionbar.shareTooltip')"
      class="size-10 rounded-lg"
      @click="() => openShareDialog().catch(toastErrorHandler)"
      @pointerenter="prefetchShareDialog"
    >
      <i class="icon-[lucide--send] size-4" />
    </Button>

    <div
      class="flex w-10 flex-col overflow-hidden rounded-lg bg-secondary-background"
    >
      <Button
        v-tooltip.right="{
          value: t('sideToolbar.mediaAssets.title'),
          ...tooltipOptions
        }"
        variant="textonly"
        size="unset"
        :aria-label="t('sideToolbar.mediaAssets.title')"
        :class="
          cn('size-10', isAssetsActive && 'bg-secondary-background-hover')
        "
        @click="openAssets"
      >
        <i class="icon-[comfy--image-ai-edit] size-4" />
      </Button>
      <Button
        v-tooltip.right="{
          value: t('linearMode.appModeToolbar.apps'),
          ...tooltipOptions
        }"
        variant="textonly"
        size="unset"
        :aria-label="t('linearMode.appModeToolbar.apps')"
        :class="cn('size-10', isAppsActive && 'bg-secondary-background-hover')"
        @click="showApps"
      >
        <i class="icon-[lucide--panels-top-left] size-4" />
      </Button>
    </div>
  </div>
</template>
