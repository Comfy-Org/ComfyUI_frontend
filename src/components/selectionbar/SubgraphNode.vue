<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { watchDebounced } from '@vueuse/core'

import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'

import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import SubgraphNodeWidget from '@/components/selectionbar/SubgraphNodeWidget.vue'
import { useCanvasStore } from '@/stores/graphStore'
const { t } = useI18n()

const canvasStore = useCanvasStore()

const expandedKeys = ref<Record<string, boolean>>({})

const triggerUpdate = ref(0)

const activeNode = computed(() => {
  return canvasStore.selectedItems[0]
})

function keyfn(item) {
      return `${item[0].title}(${item[0].id}): ${item[1].name}`
}
const activeWidgets = computed({
  get() {
    triggerUpdate.value
    const node = activeNode.value
    const pw = node.properties.proxyWidgets ?? []
    return pw.map(([id, name]) => {
      const wNode = node.subgraph._nodes_by_id[id]
      const w = wNode.widgets.find((w) => w.name === name)
      return [wNode, w]
    })
  },
  set(value) {
    //map back to id/name
    const pw = value.map(([node, widget]) => [node.id, widget.name])
    activeNode.value.properties.proxyWidgets = pw
    //force trigger an update
    triggerUpdate.value++
    canvasStore.canvas.setDirty(true)
  }
})

const candidateWidgets = computed(() =>{
  const node = canvasStore.selectedItems[0] ?? {}
  triggerUpdate.value//mark dependent
  const pw = node.properties.proxyWidgets ?? []
  const interiorNodes = node?.subgraph?.nodes ?? []
  node.widgets ??= []
  const intn = interiorNodes.flatMap((n) =>
    n.widgets?.map((w) => {
      return [n,w] ?? []
    }))
    //widget has connected link. Should not be displayed
    .filter(([_, w]) => !w.computedDisabled)
    .filter(([n,w]) => !pw.some(([pn,pw]) => n.id == pn && w.name == pw))
  //TODO: filter enabled/disabled items while keeping order
  return intn
})

</script>
<template>
  <SidebarTabTemplate
      :title="'Subgraph Node'"
      class="workflows-sidebar-tab bg-[var(--p-tree-background)]"
      >
      <template #body>
        <div class="widgets-section">
        <draggable
            v-model="activeWidgets"
            group="enabledWidgets"
            class="widget-container"
            :animation="100"
            @start="drag=true"
            @end="drag=false"
            item-key="id">
        <template #item="{element}">
          <SubgraphNodeWidget :item="element" :node="activeNode" :draggable="true"/>
        </template>
        </draggable>
        </div>
        <div class="widgets-section">
          <div v-for="element in candidateWidgets" class="widget-container">
            <SubgraphNodeWidget :item="element" :node="activeNode"/>
          </div>
        </div>
      </template>
  </SidebarTabTemplate>
</template>
<style scoped>
.widget-container {
  width: 100%
}
.widgets-section {
  display: flex;

  padding: 4px 0 16px 0;
  flex-direction: column;
  align-items: flex-start;
  align-self: stretch;
  border-bottom: 1px solid var(--color-node-divider, #2E3037);
}
</style>
