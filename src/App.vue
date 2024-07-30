<template>
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <BlockUI full-screen :blocked="isLoading" />
  <GraphCanvas />
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, watch } from 'vue'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import GraphCanvas from '@/components/graph/GraphCanvas.vue'
import QueueSideBarTab from '@/components/sidebar/tabs/QueueSideBarTab.vue'
import { app } from './scripts/app'
import { useSettingStore } from './stores/settingStore'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from './stores/workspaceStateStore'
import NodeLibrarySideBarTab from './components/sidebar/tabs/NodeLibrarySideBarTab.vue'

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

onMounted(() => {
  try {
    init()
  } catch (e) {
    console.error('Failed to init Vue app', e)
  }
})
</script>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
