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
              :aria-label="t('menu.manageExtensions')"
              class="relative"
              @click="openCustomNodeManager"
            >
              <i class="icon-[comfy--extensions-blocks] size-4" />
              <span class="not-md:hidden">
                {{ t('menu.manageExtensions') }}
              </span>
              <span
                v-if="shouldShowRedDot"
                class="absolute top-0.5 right-1 size-2 rounded-full bg-red-500"
              />
            </Button>
          </div>

          <div ref="actionbarContainerRef" :class="actionbarContainerClass">
            <ActionBarButtons />

            <ComfyActionbar
              :top-menu-container="actionbarContainerRef"
              :queue-overlay-expanded="isQueueOverlayExpanded"
              @update:progress-target="updateProgressTarget"
            />
            <CurrentUserButton
              v-if="isLoggedIn && !isIntegratedTabBar"
              class="shrink-0"
            />
            <LoginButton v-else-if="isDesktop && !isIntegratedTabBar" />
            <Button
              v-if="isCloud && flags.workflowSharingEnabled"
              v-tooltip.bottom="shareTooltipConfig"
              variant="secondary"
              :aria-label="t('actionbar.shareTooltip')"
              @click="() => openShareDialog().catch(toastErrorHandler)"
              @pointerenter="prefetchShareDialog"
            >
              <i class="icon-[comfy--send] size-4" />
              <span class="not-md:hidden">
                {{ t('actionbar.share') }}
              </span>
            </Button>
            <div v-if="!isRightSidePanelOpen" class="relative">
              <Button
                v-tooltip.bottom="rightSidePanelTooltipConfig"
                :class="
                  cn(
                    showErrorIndicatorOnPanelButton &&
                      'outline-1 outline-destructive-background'
                  )
                "
                variant="secondary"
                size="icon"
                :aria-label="t('rightSidePanel.togglePanel')"
                @click="rightSidePanelStore.togglePanel"
              >
                <i class="icon-[lucide--panel-right] size-4" />
              </Button>
              <StatusBadge
                v-if="showErrorIndicatorOnPanelButton"
                variant="dot"
                severity="danger"
                class="absolute -top-1 -right-1"
              />
            </div>
          </div>
        </div>
        <ErrorOverlay />
        <QueueProgressOverlay
          v-if="isQueueProgressOverlayEnabled"
          v-model:expanded="isQueueOverlayExpanded"
          :menu-hovered="isTopMenuHovered"
        />
      </div>
    </div>

    <div class="flex flex-col items-end gap-1">
      <Teleport
        v-if="inlineProgressSummaryTarget"
        :to="inlineProgressSummaryTarget"
      >
        <div
          class="pointer-events-none absolute inset-x-0 top-full mt-1 flex justify-end pr-1"
        >
          <QueueInlineProgressSummary
            :hidden="shouldHideInlineProgressSummary"
          />
        </div>
      </Teleport>
      <QueueInlineProgressSummary
        v-else-if="shouldShowInlineProgressSummary && !isActionbarFloating"
        class="pr-1"
        :hidden="shouldHideInlineProgressSummary"
      />
      <QueueNotificationBannerHost
        v-if="shouldShowQueueNotificationBanners"
        class="pr-1"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import SubgraphBreadcrumb from '@/components/breadcrumb/SubgraphBreadcrumb.vue'
import QueueInlineProgressSummary from '@/components/queue/QueueInlineProgressSummary.vue'
import QueueNotificationBannerHost from '@/components/queue/QueueNotificationBannerHost.vue'
import QueueProgressOverlay from '@/components/queue/QueueProgressOverlay.vue'
import ErrorOverlay from '@/components/error/ErrorOverlay.vue'
import ActionBarButtons from '@/components/topbar/ActionBarButtons.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useQueueFeatureFlags } from '@/composables/queue/useQueueFeatureFlags'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useActionBarButtonStore } from '@/stores/actionBarButtonStore'
import { useQueueUIStore } from '@/stores/queueStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { cn } from '@/utils/tailwindUtil'

const settingStore = useSettingStore()
const workspaceStore = useWorkspaceStore()
const rightSidePanelStore = useRightSidePanelStore()
const managerState = useManagerState()
const { flags } = useFeatureFlags()
const { isLoggedIn } = useCurrentUser()
const { t } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const executionErrorStore = useExecutionErrorStore()
const actionBarButtonStore = useActionBarButtonStore()
const queueUIStore = useQueueUIStore()
const { isOverlayExpanded: isQueueOverlayExpanded } = storeToRefs(queueUIStore)
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
/**
 * Whether the actionbar container has any visible docked buttons
 * (excluding ComfyActionbar, which uses position:fixed when floating
 * and does not contribute to the container's visual layout).
 */
const hasDockedButtons = computed(() => {
  if (actionBarButtonStore.buttons.length > 0) return true
  if (isLoggedIn.value && !isIntegratedTabBar.value) return true
  if (isDesktop && !isIntegratedTabBar.value) return true
  if (isCloud && flags.workflowSharingEnabled) return true
  if (!isRightSidePanelOpen.value) return true
  return false
})
const isActionbarContainerEmpty = computed(
  () => isActionbarFloating.value && !hasDockedButtons.value
)
const actionbarContainerClass = computed(() => {
  const base =
    'actionbar-container pointer-events-auto relative flex h-12 items-center gap-2 rounded-lg border bg-comfy-menu-bg shadow-interface'

  if (isActionbarContainerEmpty.value) {
    return cn(
      base,
      '-ml-2 w-0 min-w-0 border-transparent shadow-none',
      'has-[.border-dashed]:ml-0 has-[.border-dashed]:w-auto has-[.border-dashed]:min-w-auto',
      'has-[.border-dashed]:border-interface-stroke has-[.border-dashed]:pl-2 has-[.border-dashed]:shadow-interface'
    )
  }

  return cn(base, 'px-2', 'border-interface-stroke')
})
const isIntegratedTabBar = computed(
  () => settingStore.get('Comfy.UI.TabBarLayout') !== 'Legacy'
)
const { isQueuePanelV2Enabled, isRunProgressBarEnabled } =
  useQueueFeatureFlags()
const isQueueProgressOverlayEnabled = computed(
  () => !isQueuePanelV2Enabled.value
)
const shouldShowInlineProgressSummary = computed(
  () =>
    isQueuePanelV2Enabled.value &&
    isActionbarEnabled.value &&
    isRunProgressBarEnabled.value
)
const shouldShowQueueNotificationBanners = computed(
  () => isActionbarEnabled.value
)
const progressTarget = ref<HTMLElement | null>(null)
function updateProgressTarget(target: HTMLElement | null) {
  progressTarget.value = target
}
const inlineProgressSummaryTarget = computed(() => {
  if (!shouldShowInlineProgressSummary.value || !isActionbarFloating.value) {
    return null
  }
  return progressTarget.value
})
const shouldHideInlineProgressSummary = computed(
  () => isQueueProgressOverlayEnabled.value && isQueueOverlayExpanded.value
)
const customNodesManagerTooltipConfig = computed(() =>
  buildTooltipConfig(t('menu.manageExtensions'))
)
const shareTooltipConfig = computed(() =>
  buildTooltipConfig(t('actionbar.shareTooltip'))
)

const shouldShowRedDot = computed((): boolean => {
  return shouldShowConflictRedDot.value
})

const { hasAnyError, isErrorOverlayOpen } = storeToRefs(executionErrorStore)

const isErrorsTabEnabled = computed(() =>
  settingStore.get('Comfy.RightSidePanel.ShowErrorsTab')
)

const showErrorIndicatorOnPanelButton = computed(
  () =>
    isErrorsTabEnabled.value &&
    hasAnyError.value &&
    !isRightSidePanelOpen.value &&
    !isErrorOverlayOpen.value
)

// Right side panel toggle
const { isOpen: isRightSidePanelOpen } = storeToRefs(rightSidePanelStore)
const rightSidePanelTooltipConfig = computed(() =>
  buildTooltipConfig(t('rightSidePanel.togglePanel'))
)

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
