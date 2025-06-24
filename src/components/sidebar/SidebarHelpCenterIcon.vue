<template>
  <div>
    <SidebarIcon
      icon="pi pi-question-circle"
      class="comfy-help-center-btn"
      :tooltip="$t('sideToolbar.helpCenter')"
      :icon-badge="shouldShowRedDot ? '•' : ''"
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
          'small-sidebar': sidebarSize === 'small'
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
          'small-sidebar': sidebarSize === 'small'
        }"
      />
    </Teleport>

    <!-- WhatsNew Popup positioned within canvas area -->
    <Teleport to="#graph-canvas-container">
      <WhatsNewPopup
        :class="{
          'sidebar-left': sidebarLocation === 'left',
          'sidebar-right': sidebarLocation === 'right',
          'small-sidebar': sidebarSize === 'small'
        }"
      />
    </Teleport>

    <!-- Backdrop to close popup when clicking outside -->
    <Teleport to="#graph-canvas-container">
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
import { computed, onMounted, ref } from 'vue'

import HelpCenterMenuContent from '@/components/helpcenter/HelpCenterMenuContent.vue'
import ReleaseNotificationToast from '@/components/helpcenter/ReleaseNotificationToast.vue'
import WhatsNewPopup from '@/components/helpcenter/WhatsNewPopup.vue'
import { useReleaseStore } from '@/stores/releaseStore'
import { useSettingStore } from '@/stores/settingStore'

import SidebarIcon from './SidebarIcon.vue'

const settingStore = useSettingStore()
const releaseStore = useReleaseStore()
const { shouldShowRedDot } = storeToRefs(releaseStore)
const isHelpCenterVisible = ref(false)

const sidebarLocation = computed(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const sidebarSize = computed(() => settingStore.get('Comfy.Sidebar.Size'))

const toggleHelpCenter = () => {
  isHelpCenterVisible.value = !isHelpCenterVisible.value
}

const closeHelpCenter = () => {
  isHelpCenterVisible.value = false
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
  z-index: 999;
  background: transparent;
}

.help-center-popup {
  position: absolute;
  bottom: 1rem;
  z-index: 1000;
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
