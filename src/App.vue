<template>
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <div v-else>
    <NodeSearchboxPopover v-if="nodeSearchEnabled" />
    <teleport to=".graph-canvas-container">
      <LiteGraphCanvasSplitterOverlay v-if="betaMenuEnabled">
        <template #side-bar-panel>
          <SideToolBar />
        </template>
      </LiteGraphCanvasSplitterOverlay>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from 'vue'
import NodeSearchboxPopover from '@/components/NodeSearchBoxPopover.vue'
import SideToolBar from '@/components/sidebar/SideToolBar.vue'
import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import QueueSideBarTab from '@/components/sidebar/tabs/QueueSideBarTab.vue'
import ProgressSpinner from 'primevue/progressspinner'
import { app } from './scripts/app'
import { useSettingStore } from './stores/settingStore'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from './stores/workspaceStateStore'
import NodeLibrarySideBarTab from './components/sidebar/tabs/NodeLibrarySideBarTab.vue'
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { useNodeDefStore } from './stores/nodeDefStore'
import { Vector2 } from '@comfyorg/litegraph'

const isLoading = ref(true)
const nodeSearchEnabled = computed<boolean>(
  () => useSettingStore().get('Comfy.NodeSearchBoxImpl') === 'default'
)
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
const betaMenuEnabled = computed(
  () => useSettingStore().get('Comfy.UseNewMenu') !== 'Disabled'
)

const { t } = useI18n()
let dropTargetCleanup = () => {}
const init = () => {
  useSettingStore().addSettings(app.ui.settings)
  app.vueAppReady = true
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

  dropTargetCleanup = dropTargetForElements({
    element: document.querySelector('.graph-canvas-container'),
    onDrop: (event) => {
      const loc = event.location.current.input
      const pos = app.clientPosToCanvasPos(
        // Offset to account for the toolbar and menu
        // so that after drop of the node the mouse is on the node.
        // TODO(huchenlei): Make this calculation more robust
        [loc.clientX - 100, loc.clientY - 50]
      )
      const comfyNodeName = event.source.element.getAttribute(
        'data-comfy-node-name'
      )
      const nodeDef = useNodeDefStore().nodeDefsByName[comfyNodeName]
      app.addNodeOnGraph(nodeDef, { pos })
    }
  })
}

onMounted(() => {
  try {
    init()
  } catch (e) {
    console.error('Failed to init Vue app', e)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  dropTargetCleanup()
})
</script>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
