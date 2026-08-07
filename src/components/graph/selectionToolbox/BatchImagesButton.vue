<template>
  <Button
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
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
</script>
