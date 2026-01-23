<template>
  <div
    v-if="!workspaceStore.focusMode"
    class="ml-1 flex flex-col gap-1 pt-1"
    @mouseenter="isTopMenuHovered = true"
    @mouseleave="isTopMenuHovered = false"
  >
    <div class="flex gap-x-0.5">
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
            ref="actionbarContainerRef"
            class="actionbar-container relative pointer-events-auto flex gap-2 h-12 items-center rounded-lg border border-interface-stroke bg-comfy-menu-bg px-2 shadow-interface"
          >
            <ActionBarButtons />
            <!-- Support for legacy topbar elements attached by custom scripts, hidden if no elements present -->
            <div
              ref="legacyCommandsContainerRef"
              class="[&:not(:has(*>*:not(:empty)))]:hidden"
            ></div>
            <ComfyActionbar
              :top-menu-container="actionbarContainerRef"
              :queue-overlay-expanded="isQueueOverlayExpanded"
            />
            <Button
              v-tooltip.bottom="queueHistoryTooltipConfig"
              type="destructive"
              size="md"
              :aria-pressed="
                isQueuePanelV2Enabled
                  ? activeSidebarTabId === 'assets'
                  : isQueueProgressOverlayVisible
                    ? isQueueOverlayExpanded
                    : undefined
              "
              class="px-3"
              data-testid="queue-overlay-toggle"
              @click="toggleQueueOverlay"
              @contextmenu.stop.prevent="showQueueContextMenu"
            >
              <span class="text-sm font-normal tabular-nums">
                {{ activeJobsLabel }}
              </span>
              <span class="sr-only">
                {{
                  isQueuePanelV2Enabled
                    ? t('sideToolbar.queueProgressOverlay.viewJobHistory')
                    : t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')
                }}
              </span>
            </Button>
            <ContextMenu
              ref="queueContextMenu"
              :model="queueContextMenuItems"
            />
            <CurrentUserButton
              v-if="isLoggedIn && !isIntegratedTabBar"
              class="shrink-0"
            />
            <LoginButton v-else-if="isDesktop && !isIntegratedTabBar" />
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
          v-if="isQueueProgressOverlayVisible"
          v-model:expanded="isQueueOverlayExpanded"
          :menu-hovered="isTopMenuHovered"
        />
      </div>
    </div>

    <div>
      <QueueInlineProgressSummary
        v-if="
          isInlineProgressVisible && isActionbarEnabled && !isActionbarFloating
        "
        class="pr-1"
        :hidden="isQueueOverlayExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import QueueInlineProgressSummary from '@/components/queue/QueueInlineProgressSummary.vue'
import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import ActionBarButtons from '@/components/topbar/ActionBarButtons.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore, useQueueUIStore } from '@/stores/queueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isElectron } from '@/utils/envUtil'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const settingStore = useSettingStore()
const workspaceStore = useWorkspaceStore()
const rightSidePanelStore = useRightSidePanelStore()
const managerState = useManagerState()
const { isLoggedIn } = useCurrentUser()
const isDesktop = isElectron()
const { t, n } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const commandStore = useCommandStore()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()
const queueUIStore = useQueueUIStore()
const sidebarTabStore = useSidebarTabStore()
const { activeJobsCount } = storeToRefs(queueStore)
const { isOverlayExpanded: isQueueOverlayExpanded } = storeToRefs(queueUIStore)
const { activeSidebarTabId } = storeToRefs(sidebarTabStore)
const releaseStore = useReleaseStore()
const { shouldShowRedDot: showReleaseRedDot } = storeToRefs(releaseStore)
const { shouldShowRedDot: shouldShowConflictRedDot } =
  useConflictAcknowledgment()
const isTopMenuHovered = ref(false)
const actionbarContainerRef = ref<HTMLElement>()
const isActionbarDocked = useLocalStorage('Comfy.MenuPosition.Docked', true)
const actionbarPosition = computed(() => settingStore.get('Comfy.UseNewMenu'))
const isActionbarEnabled = computed(
  () => actionbarPosition.value !== 'Disabled'
)
const isActionbarFloating = computed(
  () => isActionbarEnabled.value && !isActionbarDocked.value
)
const activeJobsLabel = computed(() => {
  const count = activeJobsCount.value
  return t(
    'sideToolbar.queueProgressOverlay.activeJobsShort',
    { count: n(count) },
    count
  )
})
const isIntegratedTabBar = computed(
  () => settingStore.get('Comfy.UI.TabBarLayout') === 'Integrated'
)
const isQueuePanelV2Enabled = computed(() =>
  settingStore.get('Comfy.Queue.QPOV2')
)
const isQueueProgressOverlayVisible = computed(
  () => !isQueuePanelV2Enabled.value
)
const isInlineProgressVisible = computed(() => isQueuePanelV2Enabled.value)
const queueHistoryTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.viewJobHistory'))
)
const customNodesManagerTooltipConfig = computed(() =>
  buildTooltipConfig(t('menu.customNodesManager'))
)
const queueContextMenu = ref<InstanceType<typeof ContextMenu> | null>(null)
const queueContextMenuItems = computed<MenuItem[]>(() => [
  {
    label: t('sideToolbar.queueProgressOverlay.clearQueueTooltip'),
    icon: 'icon-[lucide--list-x] text-destructive-background',
    class: '*:text-destructive-background',
    disabled: queueStore.pendingTasks.length === 0,
    command: () => {
      void handleClearQueue()
    }
  }
])

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
  if (isQueuePanelV2Enabled.value) {
    sidebarTabStore.toggleSidebarTab('assets')
    return
  }
  commandStore.execute('Comfy.Queue.ToggleOverlay')
}

const showQueueContextMenu = (event: MouseEvent) => {
  queueContextMenu.value?.show(event)
}

const handleClearQueue = async () => {
  const pendingPromptIds = queueStore.pendingTasks
    .map((task) => task.promptId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  await commandStore.execute('Comfy.ClearPendingTasks')
  executionStore.clearInitializationByPromptIds(pendingPromptIds)
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
