<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useCanvasStore } from '@/stores/graphStore'

function hasWidget() {
  return props.node.widgets.some((w) => w.name === props.item[1].name)
}

let isShown = ref(false)

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  item: [unknown, unknown],
  node: unknown
  draggable?: boolean
}>()

onMounted(() => {
  isShown.value = hasWidget()
})

function onClick(e) {
  //props.node?.onToggle()
  const nodeId = props.item[0].id
  const widgetName = props.item[1].name
  const node = props.node

  const { widgetStates } = useDomWidgetStore()
  if (!isShown.value) {
    const w = node.addProxyWidget(`${nodeId}`, widgetName)
    if (widgetStates.has(w.id)) {
      const widgetState = widgetStates.get(w.id)
      widgetState.active = true
      widgetState.widget = w
    }
    isShown.value = true
  } else {
    const index = node.widgets.findIndex((w) => w.name === widgetName)
    if (index < 0) throw new Error("Can't disable missing widget")
    const [w] = node.widgets.splice(index, 1)
    if (widgetStates.has(w.id)) {
      widgetStates.get(w.id).active = false
    }
    const { properties } = node
    properties.proxyWidgets = properties.proxyWidgets.filter((p) => {
    return p[1] !== widgetName
      //NOTE: intentional loose as nodeId is often string/int
      || p[0] != nodeId})

    isShown.value = false
  }
  useCanvasStore().canvas.setDirty(true)
}
</script>
<template>
  <div class="widget-item">
    <div v-if="draggable">
      <i-lucide:grip-vertical/>
    </div>
    <div class="widget-title">
      <div class="widget-node">{{item[0].title}}</div>
      <div class="widget-name">{{item[1].name}}</div>
    </div>
    <Button
      size="small"
      text
      severity="secondary"
      @click.stop="onClick"
    >
      <i-lucide:eye v-if="isShown"/>
      <i-lucide:eye-off v-else/>
    </Button>
  </div>
</template>

<style scoped>
.widget-item {
  display: flex;
  padding: 4px 16px 4px 0;
  align-items: center;
  gap: 4px;
  align-self: stretch;
  border-radius: 4px;
  background: var(--bg-color, #202020);
}
.widget-title {
display: flex;
width: 269px;
flex-direction: column;
align-items: flex-start;
gap: 4px;
}
.widget-node {
  display: flex;
  height: 15px;
  flex-direction: column;
  justify-content: flex-end;
  align-self: stretch;
  color: var(--color-text-secondary, #9C9EAB);

  /* heading-text-nav */
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
.widget-name {
  color: var(--color-text-primary, #FFF);
  
  /* body-text-small */
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
</style>
