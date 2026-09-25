<template>
  <Tooltip
    :config="{
      value: $t('commands.Comfy_PublishSubgraph.label'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      v-show="isVisible"
      variant="muted-textonly"
      :aria-label="$t('commands.Comfy_PublishSubgraph.label')"
      @click="() => commandStore.execute('Comfy.PublishSubgraph')"
    >
      <i class="icon-[lucide--book-open]" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { SubgraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const canvasStore = useCanvasStore()

const isVisible = computed(() => {
  return (
    canvasStore.selectedItems?.length === 1 &&
    canvasStore.selectedItems[0] instanceof SubgraphNode
  )
})
</script>
