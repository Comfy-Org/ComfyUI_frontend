<template>
  <Tooltip
    v-if="isUnpackVisible"
    :config="{
      value: $t('commands.Comfy_Graph_UnpackSubgraph.label'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      variant="muted-textonly"
      :aria-label="$t('commands.Comfy_Graph_UnpackSubgraph.label')"
      data-testid="convert-to-subgraph-button"
      @click="() => commandStore.execute('Comfy.Graph.UnpackSubgraph')"
    >
      <i class="icon-[lucide--expand] size-4" />
    </Button>
  </Tooltip>
  <Tooltip
    v-else-if="isConvertVisible"
    :config="{
      value: $t('commands.Comfy_Graph_ConvertToSubgraph.label'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      variant="muted-textonly"
      size="icon"
      :aria-label="$t('commands.Comfy_Graph_ConvertToSubgraph.label')"
      data-testid="convert-to-subgraph-button"
      @click="() => commandStore.execute('Comfy.Graph.ConvertToSubgraph')"
    >
      <i class="icon-[lucide--shrink] size-4" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

const commandStore = useCommandStore()
const { isSingleSubgraph, hasAnySelection } = useSelectionState()

const isUnpackVisible = isSingleSubgraph
const isConvertVisible = computed(
  () => hasAnySelection.value && !isSingleSubgraph.value
)
</script>
