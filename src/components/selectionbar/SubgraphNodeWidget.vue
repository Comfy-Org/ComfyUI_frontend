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
  <div class="widget-item">
    <div class="icon">
      <i-lucide:grip-vertical v-if="isDraggable" />
    </div>
    <div class="widget-title">
      <div class="widget-node">{{ nodeTitle }}</div>
      <div class="widget-name">{{ widgetName }}</div>
    </div>
    <Button size="small" text severity="secondary" @click.stop="onClick">
      <i-lucide:eye v-if="isShown" />
      <i-lucide:eye-off v-else />
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
  color: var(--color-text-secondary, #9c9eab);

  /* heading-text-nav */
  font-family: Inter;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
.widget-name {
  color: var(--color-text-primary, #fff);

  /* body-text-small */
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}
</style>
