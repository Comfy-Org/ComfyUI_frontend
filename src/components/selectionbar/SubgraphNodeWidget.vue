<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import { useCanvasStore } from '@/stores/graphStore'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

const props = defineProps<{
  item: [unknown, unknown],
  node: unknown,
  isShown?: boolean,
  toggleVisibility
}>()

function onClick(e) {
  props.toggleVisibility(`${props.item[0].id}`, props.item[1].name, props.isShown)
}
</script>
<template>
  <div class="widget-item">
    <div class="icon">
      <i-lucide:grip-vertical v-if="draggable"/>
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
.icon {
  width: 16px;
  height: 16px;
}
.widget-item {
  display: flex;
  padding: 4px 16px 4px 0;
  align-items: center;
  gap: 4px;
  width: 100%;
  border-radius: 4px;
  background: var(--bg-color, #202020);
}
.widget-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1 0 0;
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
