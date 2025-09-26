<script setup lang="ts">
import Button from 'primevue/button'

const props = defineProps<{
  nodeId: string
  nodeTitle: string
  widgetName: string
  isShown?: boolean
  isDraggable?: boolean
  toggleVisibility: (
    nodeId: string,
    widgetName: string,
    isShown: boolean
  ) => void
}>()

function onClick() {
  props.toggleVisibility(props.nodeId, props.widgetName, props.isShown ?? false)
}
</script>
<template>
  <div class="widget-item items-center gap-1">
    <div class="size-4">
      <i-lucide:grip-vertical v-if="isDraggable" />
    </div>
    <div class="flex-1">
      <div class="widget-node">{{ nodeTitle }}</div>
      <div class="widget-name">{{ widgetName }}</div>
    </div>
    <Button
      size="small"
      class="shrink-0"
      text
      severity="secondary"
      @click.stop="onClick"
    >
      <i-lucide:eye v-if="isShown" />
      <i-lucide:eye-off v-else />
    </Button>
  </div>
</template>

<style scoped>
.widget-item {
  display: flex;
  padding: 4px 16px 4px 0;
  word-break: break-all;
  border-radius: 4px;
  background: var(--bg-color, #202020);
}
.widget-node {
  color: var(--color-slate-100, #9c9eab);

  /* heading-text-nav */
  font-family: Inter;
  font-size: 10px;
}
.widget-name {
  color: var(--color-text-primary, #fff);

  /* body-text-small */
  font-family: Inter;
  font-size: 12px;
}
</style>
