<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { t } from '@/i18n'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

const canvasStore = useCanvasStore()
function toggleLinearMode() {
  useCommandStore().execute('Comfy.ToggleLinear', {
    metadata: { source: 'button' }
  })
}
</script>
<template>
  <div class="p-1 bg-secondary-background rounded-lg w-10">
    <Button
      v-tooltip="{
        value: t('linearMode.linearMode'),
        showDelay: 300,
        hideDelay: 300
      }"
      size="icon"
      :variant="canvasStore.linearMode ? 'inverted' : 'secondary'"
      @click="toggleLinearMode"
    >
      <i class="icon-[lucide--panels-top-left]" />
    </Button>
    <Button
      v-tooltip="{
        value: t('linearMode.graphMode'),
        showDelay: 300,
        hideDelay: 300
      }"
      size="icon"
      :variant="canvasStore.linearMode ? 'secondary' : 'inverted'"
      @click="toggleLinearMode"
    >
      <i class="icon-[comfy--workflow]" />
    </Button>
  </div>
</template>
