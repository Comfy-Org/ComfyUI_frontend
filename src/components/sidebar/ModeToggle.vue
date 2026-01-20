<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { t } from '@/i18n'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

const canvasStore = useCanvasStore()
</script>
<template>
  <div class="w-10 rounded-lg bg-secondary-background p-1">
    <Button
      size="icon"
      :title="t('linearMode.linearMode')"
      :variant="canvasStore.linearMode ? 'inverted' : 'secondary'"
      @click="useCommandStore().execute('Comfy.ToggleLinear')"
    >
      <i class="icon-[lucide--panels-top-left]" />
    </Button>
    <Button
      size="icon"
      :title="t('linearMode.graphMode')"
      :variant="canvasStore.linearMode ? 'secondary' : 'inverted'"
      @click="useCommandStore().execute('Comfy.ToggleLinear')"
    >
      <i class="icon-[comfy--workflow]" />
    </Button>
  </div>
</template>
