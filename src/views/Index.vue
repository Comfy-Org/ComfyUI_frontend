<template>
  <div class="litegraph absolute inset-0 overflow-hidden">
    <NodeSearchboxPopover v-if="nodeSearchEnabled" />
    <GraphCanvas @ready="onCanvasReady" />
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import GraphCanvas from '@/views/graph/GraphCanvas.vue'
import NodeSearchboxPopover from '@/components/NodeSearchBoxPopover.vue'
import QueueSideBarTab from '@/components/sidebar/tabs/QueueSideBarTab.vue'
import { app as comfyApp } from '@/scripts/app'
import { useNodeDefStore, useSettingStore } from '@/stores'
import { ExtensionManagerImpl } from '@/scripts/extensionManager'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const nodeDefStore = useNodeDefStore()
const settingsStore = useSettingStore()

const nodeSearchEnabled = computed<boolean>(
  () => settingsStore.get('Comfy.NodeSearchBoxImpl') === 'default'
)

const onCanvasReady = () => {
  /* TODO:
   * remove theses exposition to window's scope when we have the plugin SDK
   * no plugin or extension should be able to access our DOM directly
   */
  window['app'] = comfyApp
  window['graph'] = comfyApp.graph

  nodeDefStore.addNodeDefs(Object.values(comfyApp.nodeDefs))
  settingsStore.addSettings(comfyApp.ui.settings)
  comfyApp.vueAppReady = true
  // Late init as extension manager needs to access pinia store.
  comfyApp.extensionManager = new ExtensionManagerImpl()

  /* TODO: way to complexe (will be fixed with plugin SDK) */
  comfyApp.extensionManager.registerSidebarTab({
    id: 'queue',
    icon: 'pi pi-history',
    title: t('sideToolBar.queue'),
    tooltip: t('sideToolBar.queue'),
    component: markRaw(QueueSideBarTab),
    type: 'vue'
  })
}
</script>
