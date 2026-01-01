<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { t } from '@/i18n'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const canvasStore = useCanvasStore()
</script>
<template>
  <div class="p-1 bg-secondary-background rounded-lg w-10">
    <Button
      class="disabled:opacity-100"
      size="icon"
      :title="t('Simple Mode')"
      :disabled="canvasStore.linearMode"
      :variant="canvasStore.linearMode ? 'inverted' : 'secondary'"
      @click="canvasStore.linearMode = true"
    >
      <i class="icon-[lucide--panels-top-left]" />
    </Button>
    <Button
      class="disabled:opacity-100"
      size="icon"
      :title="t('Graph Mode')"
      :disabled="!canvasStore.linearMode"
      :variant="canvasStore.linearMode ? 'secondary' : 'inverted'"
      @click="canvasStore.linearMode = false"
    >
      <i class="icon-[comfy--workflow]" />
    </Button>
  </div>
</template>
