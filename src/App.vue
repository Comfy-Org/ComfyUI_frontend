<template>
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <BlockUI full-screen :blocked="isLoading" />
  <GlobalDialog />
  <GraphCanvas />
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, watch } from 'vue'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import GraphCanvas from '@/components/graph/GraphCanvas.vue'
import QueueSideBarTab from '@/components/sidebar/tabs/QueueSideBarTab.vue'
import { app } from './scripts/app'
import { useSettingStore } from './stores/settingStore'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from './stores/workspaceStateStore'
import NodeLibrarySideBarTab from './components/sidebar/tabs/NodeLibrarySideBarTab.vue'
import GlobalDialog from './components/dialog/GlobalDialog.vue'
import { api } from './scripts/api'
import { StatusWsMessageStatus } from './types/apiTypes'
import { useQueuePendingTaskCountStore } from './stores/queueStore'

const isLoading = computed<boolean>(() => useWorkspaceStore().spinner)
const theme = computed<string>(() =>
  useSettingStore().get('Comfy.ColorPalette')
)
watch(
  theme,
  (newTheme) => {
    const DARK_THEME_CLASS = 'dark-theme'
    const isDarkTheme = newTheme !== 'light'
    if (isDarkTheme) {
      document.body.classList.add(DARK_THEME_CLASS)
    } else {
      document.body.classList.remove(DARK_THEME_CLASS)
    }
  },
  { immediate: true }
)

const { t } = useI18n()
const init = () => {
  useSettingStore().addSettings(app.ui.settings)
  app.extensionManager = useWorkspaceStore()
  app.extensionManager.registerSidebarTab({
    id: 'queue',
    icon: 'pi pi-history',
    iconBadge: () => {
      const value = useQueuePendingTaskCountStore().count.toString()
      return value === '0' ? null : value
    },
    title: t('sideToolBar.queue'),
    tooltip: t('sideToolBar.queue'),
    component: markRaw(QueueSideBarTab),
    type: 'vue'
  })
  app.extensionManager.registerSidebarTab({
    id: 'node-library',
    icon: 'pi pi-book',
    title: t('sideToolBar.nodeLibrary'),
    tooltip: t('sideToolBar.nodeLibrary'),
    component: markRaw(NodeLibrarySideBarTab),
    type: 'vue'
  })
}

const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
const onStatus = (e: CustomEvent<StatusWsMessageStatus>) =>
  queuePendingTaskCountStore.update(e)

onMounted(() => {
  api.addEventListener('status', onStatus)
  try {
    init()
  } catch (e) {
    console.error('Failed to init Vue app', e)
  }
})

onUnmounted(() => {
  api.removeEventListener('status', onStatus)
})
</script>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
