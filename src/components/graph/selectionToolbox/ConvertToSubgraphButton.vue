<template>
  <Button
    v-show="isVisible"
    v-tooltip.top="{
      value: t('commands.Comfy_Graph_ConvertToSubgraph.label'),
      showDelay: 1000
    }"
    severity="secondary"
    text
    @click="() => commandStore.execute('Comfy.Graph.ConvertToSubgraph')"
  >
    <template #icon>
      <i-lucide:shrink />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useCanvasStore } from '@/stores/graphStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const isVisible = computed(() => {
  return (
    canvasStore.groupSelected ||
    canvasStore.rerouteSelected ||
    canvasStore.nodeSelected
  )
})
</script>
