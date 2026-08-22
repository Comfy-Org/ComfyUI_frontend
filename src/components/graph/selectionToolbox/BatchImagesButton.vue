<template>
  <Button
    v-if="canAddSelectedImagesToBatch"
    v-tooltip.top="{
      value: $t('commands.Comfy_Graph_AddSelectedImagesToBatch.label'),
      showDelay: 1000
    }"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Graph_AddSelectedImagesToBatch.label')"
    data-testid="add-to-batch-button"
    @click="() => commandStore.execute('Comfy.Graph.AddSelectedImagesToBatch')"
  >
    <i class="icon-[lucide--image-plus]" />
  </Button>
  <Button
    v-else
    v-tooltip.top="{
      value: $t('commands.Comfy_Graph_BatchSelectedImageNodes.label'),
      showDelay: 1000
    }"
    variant="muted-textonly"
    :aria-label="$t('commands.Comfy_Graph_BatchSelectedImageNodes.label')"
    data-testid="batch-images-button"
    @click="() => commandStore.execute('Comfy.Graph.BatchSelectedImageNodes')"
  >
    <i class="icon-[lucide--images]" />
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const { canAddSelectedImagesToBatch } = useSelectionState()
</script>
