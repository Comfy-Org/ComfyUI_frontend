<template>
  <div
    v-if="!workspaceStore.focusMode"
    class="ml-1 flex gap-x-0.5 pt-1"
    @mouseenter="isTopMenuHovered = true"
    @mouseleave="isTopMenuHovered = false"
  >
    <div class="min-w-0 flex-1">
      <SubgraphBreadcrumb />
    </div>

    <div class="mx-1 flex flex-col items-end gap-1">
      <div
        class="actionbar-container pointer-events-auto flex h-12 items-center rounded-lg border border-interface-stroke px-2 shadow-interface"
      >
        <ActionBarButtons />
        <!-- Support for legacy topbar elements attached by custom scripts, hidden if no elements present -->
        <div
          ref="legacyCommandsContainerRef"
          class="[&:not(:has(*>*:not(:empty)))]:hidden"
        ></div>
        <ComfyActionbar />
        <IconButton
          v-tooltip.bottom="cancelJobTooltipConfig"
          type="transparent"
          size="sm"
          class="mr-2 bg-destructive-background text-base-foreground transition-colors duration-200 ease-in-out hover:bg-destructive-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive-background"
          :disabled="isExecutionIdle"
          :aria-label="t('menu.interrupt')"
          @click="cancelCurrentJob"
        >
          <i class="icon-[lucide--x] size-4" />
        </IconButton>
        <IconTextButton
          v-tooltip.bottom="queueHistoryTooltipConfig"
          size="sm"
          type="secondary"
          icon-position="right"
          class="mr-2 h-8 border-0 px-3 text-sm font-medium text-base-foreground cursor-pointer"
          :aria-pressed="isQueueOverlayExpanded"
          :aria-label="queueToggleLabel"
          :label="queueToggleLabel"
          @click="toggleQueueOverlay"
        >
          <template #icon>
            <i class="icon-[lucide--chevron-down] size-4" />
          </template>
        </IconTextButton>
        <CurrentUserButton v-if="isLoggedIn" class="shrink-0" />
        <LoginButton v-else-if="isDesktop" />
        <IconButton
          v-if="!isRightSidePanelOpen"
          v-tooltip.bottom="rightSidePanelTooltipConfig"
          type="transparent"
          size="sm"
          class="mr-2 text-base-foreground transition-colors duration-200 ease-in-out bg-secondary-background hover:bg-secondary-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background"
          :aria-label="t('rightSidePanel.togglePanel')"
          @click="rightSidePanelStore.togglePanel"
        >
          <i class="icon-[lucide--panel-right] size-4" />
        </IconButton>
      </div>
      <QueueProgressOverlay
        v-model:expanded="isQueueOverlayExpanded"
        :menu-hovered="isTopMenuHovered"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import IconButton from '@/components/button/IconButton.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import ActionBarButtons from '@/components/topbar/ActionBarButtons.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isElectron } from '@/utils/envUtil'

const workspaceStore = useWorkspaceStore()
const rightSidePanelStore = useRightSidePanelStore()
const executionStore = useExecutionStore()
const commandStore = useCommandStore()
const { isLoggedIn } = useCurrentUser()
const isDesktop = isElectron()
const { t } = useI18n()
const isQueueOverlayExpanded = ref(false)
const queueStore = useQueueStore()
const isTopMenuHovered = ref(false)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const queueToggleLabel = computed(() =>
  t('sideToolbar.queueProgressOverlay.toggleLabel', {
    count: queuedCount.value
  })
)
const { isIdle: isExecutionIdle } = storeToRefs(executionStore)
const queueHistoryTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.viewJobHistory'))
)
const cancelJobTooltipConfig = computed(() =>
  buildTooltipConfig(t('menu.interrupt'))
)

// Right side panel toggle
const { isOpen: isRightSidePanelOpen } = storeToRefs(rightSidePanelStore)
const rightSidePanelTooltipConfig = computed(() =>
  buildTooltipConfig(t('rightSidePanel.togglePanel'))
)

// Maintain support for legacy topbar elements attached by custom scripts
const legacyCommandsContainerRef = ref<HTMLElement>()
onMounted(() => {
  if (legacyCommandsContainerRef.value) {
    app.menu.element.style.width = 'fit-content'
    legacyCommandsContainerRef.value.appendChild(app.menu.element)
  }
})

const toggleQueueOverlay = () => {
  isQueueOverlayExpanded.value = !isQueueOverlayExpanded.value
}

const cancelCurrentJob = async () => {
  if (isExecutionIdle.value) return
  await commandStore.execute('Comfy.Interrupt')
}
</script>

<style scoped>
.actionbar-container {
  background-color: var(--comfy-menu-bg);
}
</style>
