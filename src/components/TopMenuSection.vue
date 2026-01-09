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
      <div class="flex items-center gap-2">
        <div
          v-if="managerState.shouldShowManagerButtons.value"
          class="pointer-events-auto flex h-12 shrink-0 items-center rounded-lg border border-interface-stroke bg-comfy-menu-bg px-2 shadow-interface"
        >
          <Button
            v-tooltip.bottom="customNodesManagerTooltipConfig"
            variant="secondary"
            size="icon"
            :aria-label="t('menu.customNodesManager')"
            class="relative"
            @click="openCustomNodeManager"
          >
            <i class="icon-[lucide--puzzle] size-4" />
            <span
              v-if="shouldShowRedDot"
              class="absolute top-0.5 right-1 size-2 rounded-full bg-red-500"
            />
          </Button>
        </div>

        <div
          class="actionbar-container pointer-events-auto flex gap-2 h-12 items-center rounded-lg border border-interface-stroke bg-comfy-menu-bg px-2 shadow-interface"
        >
          <ActionBarButtons />
          <!-- Support for legacy topbar elements attached by custom scripts, hidden if no elements present -->
          <div
            ref="legacyCommandsContainerRef"
            class="[&:not(:has(*>*:not(:empty)))]:hidden"
          ></div>
          <ComfyActionbar />
          <Button
            v-tooltip.bottom="queueHistoryTooltipConfig"
            type="destructive"
            size="icon"
            :aria-pressed="isQueueOverlayExpanded"
            :aria-label="
              t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')
            "
            @click="toggleQueueOverlay"
          >
            <i class="icon-[lucide--history] size-4" />
            <span
              v-if="queuedCount > 0"
              class="absolute -top-1 -right-1 min-w-[16px] rounded-full bg-primary-background py-0.25 text-[10px] font-medium leading-[14px] text-base-foreground"
            >
              {{ queuedCount }}
            </span>
          </Button>
          <CurrentUserButton v-if="isLoggedIn" class="shrink-0" />
          <LoginButton v-else-if="isDesktop" />
          <Button
            v-if="!isRightSidePanelOpen"
            v-tooltip.bottom="rightSidePanelTooltipConfig"
            type="secondary"
            size="icon"
            :aria-label="t('rightSidePanel.togglePanel')"
            @click="rightSidePanelStore.togglePanel"
          >
            <i class="icon-[lucide--panel-right] size-4" />
          </Button>
        </div>
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
import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import ActionBarButtons from '@/components/topbar/ActionBarButtons.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore, useQueueUIStore } from '@/stores/queueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isElectron } from '@/utils/envUtil'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const workspaceStore = useWorkspaceStore()
const rightSidePanelStore = useRightSidePanelStore()
const managerState = useManagerState()
const { isLoggedIn } = useCurrentUser()
const isDesktop = isElectron()
const { t } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const commandStore = useCommandStore()
const queueStore = useQueueStore()
const queueUIStore = useQueueUIStore()
const { isOverlayExpanded: isQueueOverlayExpanded } = storeToRefs(queueUIStore)
const releaseStore = useReleaseStore()
const { shouldShowRedDot: showReleaseRedDot } = storeToRefs(releaseStore)
const { shouldShowRedDot: shouldShowConflictRedDot } =
  useConflictAcknowledgment()
const isTopMenuHovered = ref(false)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const queueHistoryTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.viewJobHistory'))
)
const customNodesManagerTooltipConfig = computed(() =>
  buildTooltipConfig(t('menu.customNodesManager'))
)

// Use either release red dot or conflict red dot
const shouldShowRedDot = computed((): boolean => {
  const releaseRedDot = showReleaseRedDot.value
  return releaseRedDot || shouldShowConflictRedDot.value
})

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
  commandStore.execute('Comfy.Queue.ToggleOverlay')
}

const openCustomNodeManager = async () => {
  try {
    await managerState.openManager({
      initialTab: ManagerTab.All,
      showToastOnLegacyError: false
    })
  } catch (error) {
    try {
      toastErrorHandler(error)
    } catch (toastError) {
      console.error(error)
      console.error(toastError)
    }
  }
}
</script>
