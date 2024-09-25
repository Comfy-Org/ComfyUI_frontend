<template>
  <ButtonGroup
    class="p-buttongroup-vertical absolute bottom-[50px] right-[50px] z-[1000] pointer-events-auto"
  >
    <Button
      severity="secondary"
      icon="pi pi-plus"
      v-tooltip.left="t('graphCanvasMenu.zoomIn')"
      @mousedown="repeat('Comfy.Canvas.ZoomIn')"
      @mouseup="stopRepeat"
    />
    <Button
      severity="secondary"
      icon="pi pi-minus"
      v-tooltip.left="t('graphCanvasMenu.zoomOut')"
      @mousedown="repeat('Comfy.Canvas.ZoomOut')"
      @mouseup="stopRepeat"
    />
    <Button
      severity="secondary"
      icon="pi pi-expand"
      v-tooltip.left="t('graphCanvasMenu.resetView')"
      @click="() => commandStore.getCommandFunction('Comfy.Canvas.ResetView')()"
    />
    <Button
      severity="secondary"
      v-tooltip.left="
        t('graphCanvasMenu.' + (canvasStore.readOnly ? 'unlock' : 'lock'))
      "
      @click="() => commandStore.getCommandFunction('Comfy.Canvas.ToggleLock')()"
    >
      <template #icon>
        <i-material-symbols:lock-outline v-if="canvasStore.readOnly" />
        <i-material-symbols:lock-open-outline v-else />
      </template>
    </Button>
  </ButtonGroup>
</template>

<script setup lang="ts">
import ButtonGroup from 'primevue/buttongroup'
import Button from 'primevue/button'
import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

let interval: number | null = null
const repeat = (command: string) => {
  if (interval) return
  const cmd = commandStore.getCommandFunction(command)
  cmd()
  interval = window.setInterval(cmd, 100)
}
const stopRepeat = () => {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
</script>

<style lang="css" scoped>
.p-buttongroup-vertical {
  display: flex;
  flex-direction: column;
  border-radius: var(--p-button-border-radius);
  overflow: hidden;
  border: 1px solid var(--p-panel-border-color);
}

.p-buttongroup-vertical .p-button {
  margin: 0;
  border-radius: 0;
}
</style>
