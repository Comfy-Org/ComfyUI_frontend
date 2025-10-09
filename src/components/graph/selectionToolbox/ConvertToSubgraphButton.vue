<template>
  <Button
    v-if="isUnpackVisible"
    v-tooltip.top="{
      value: t('commands.Comfy_Graph_UnpackSubgraph.label'),
      showDelay: 1000
    }"
    severity="secondary"
    data-testid="convert-to-subgraph-button"
    text
    @click="() => commandStore.execute('Comfy.Graph.UnpackSubgraph')"
  >
    <template #icon>
      <i class="icon-[lucide--expand] h-4 w-4" />
    </template>
  </Button>
  <Button
    v-else-if="isConvertVisible"
    v-tooltip.top="{
      value: t('commands.Comfy_Graph_ConvertToSubgraph.label'),
      showDelay: 1000
    }"
    severity="secondary"
    data-testid="convert-to-subgraph-button"
    text
    @click="() => commandStore.execute('Comfy.Graph.ConvertToSubgraph')"
  >
    <template #icon>
      <i class="icon-[lucide--shrink]" />
    </template>
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { isSingleSubgraph, hasAnySelection } = useSelectionState()

const isUnpackVisible = isSingleSubgraph
const isConvertVisible = computed(
  () => hasAnySelection.value && !isSingleSubgraph.value
)
</script>
