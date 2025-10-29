<template>
  <div>
    <SidebarIcon
      icon="pi pi-question-circle"
      class="comfy-help-center-btn"
      :label="$t('menu.help')"
      :tooltip="$t('sideToolbar.helpCenter')"
      :icon-badge="shouldShowRedDot ? '•' : ''"
      :is-small="isSmall"
      @click="toggleHelpCenter"
    />

    <!-- Help Center Popup positioned within canvas area -->
    <Teleport to="#graph-canvas-container">
      <div
        v-if="isHelpCenterVisible"
        class="help-center-popup"
        :class="{
          'sidebar-left': sidebarLocation === 'left',
          'sidebar-right': sidebarLocation === 'right',
          'small-sidebar': isSmall
        }"
      >
        <HelpCenterMenuContent @close="closeHelpCenter" />
      </div>
    </Teleport>

    <!-- Release Notification Toast positioned within canvas area -->
    <Teleport to="#graph-canvas-container">
      <ReleaseNotificationToast
        :class="{
          'sidebar-left': sidebarLocation === 'left',
          'sidebar-right': sidebarLocation === 'right',
          'small-sidebar': isSmall
        }"
      />
    </Teleport>

    <!-- WhatsNew Popup positioned within canvas area -->
    <Teleport to="#graph-canvas-container">
      <WhatsNewPopup
        :class="{
          'sidebar-left': sidebarLocation === 'left',
          'sidebar-right': sidebarLocation === 'right',
          'small-sidebar': isSmall
        }"
        @whats-new-dismissed="handleWhatsNewDismissed"
      />
    </Teleport>

    <!-- Backdrop to close popup when clicking outside -->
    <Teleport to="body">
      <div
        v-if="isHelpCenterVisible"
        class="help-center-backdrop"
        @click="closeHelpCenter"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, toRefs } from 'vue'

import HelpCenterMenuContent from '@/components/helpcenter/HelpCenterMenuContent.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import ReleaseNotificationToast from '@/platform/updates/components/ReleaseNotificationToast.vue'
import WhatsNewPopup from '@/platform/updates/components/WhatsNewPopup.vue'
import { useDialogService } from '@/services/dialogService'
import { useHelpCenterStore } from '@/stores/helpCenterStore'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'

import SidebarIcon from './SidebarIcon.vue'

const settingStore = useSettingStore()
const releaseStore = useReleaseStore()
const helpCenterStore = useHelpCenterStore()
const { isVisible: isHelpCenterVisible } = storeToRefs(helpCenterStore)
const { shouldShowRedDot: showReleaseRedDot } = storeToRefs(releaseStore)

const conflictDetection = useConflictDetection()

const { showNodeConflictDialog } = useDialogService()

// Use conflict acknowledgment state from composable - call only once
const { shouldShowRedDot: shouldShowConflictRedDot, markConflictsAsSeen } =
  useConflictAcknowledgment()

const props = defineProps<{
  isSmall: boolean
}>()
const { isSmall } = toRefs(props)

// Use either release red dot or conflict red dot
const shouldShowRedDot = computed((): boolean => {
  const releaseRedDot = showReleaseRedDot.value
  return releaseRedDot || shouldShowConflictRedDot.value
})

const sidebarLocation = computed(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const toggleHelpCenter = () => {
  helpCenterStore.toggle()
}

const closeHelpCenter = () => {
  helpCenterStore.hide()
}

/**
 * Handle What's New popup dismissal
 * Check if conflict modal should be shown after ComfyUI update
 */
const handleWhatsNewDismissed = async () => {
  try {
    // Check if conflict modal should be shown after update
    const shouldShow =
      await conflictDetection.shouldShowConflictModalAfterUpdate()
    if (shouldShow) {
      showConflictModal()
    }
  } catch (error) {
    console.error('[HelpCenter] Error checking conflict modal:', error)
  }
}
/**
 * Show the node conflict dialog with current conflict data
 */
const showConflictModal = () => {
  showNodeConflictDialog({
    showAfterWhatsNew: true,
    dialogComponentProps: {
      onClose: () => {
        markConflictsAsSeen()
      }
    }
  })
}

// Initialize release store on mount
onMounted(async () => {
  // Initialize release store to fetch releases for toast and popup
  await releaseStore.initialize()
})
</script>

<style scoped>
.help-center-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: transparent;
}

.help-center-popup {
  position: absolute;
  bottom: 1rem;
  z-index: 10000;
  animation: slideInUp 0.2s ease-out;
  pointer-events: auto;
}

.help-center-popup.sidebar-left {
  left: 1rem;
}

.help-center-popup.sidebar-left.small-sidebar {
  left: 1rem;
}

.help-center-popup.sidebar-right {
  right: 1rem;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.p-badge) {
  background: #ff3b30;
  color: #ff3b30;
  min-width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 9999px;
  font-size: 0;
  margin-top: 4px;
  margin-right: 4px;
  border: none;
  outline: none;
  box-shadow: none;
}

:deep(.p-badge.p-badge-dot) {
  width: 8px !important;
}
</style>
