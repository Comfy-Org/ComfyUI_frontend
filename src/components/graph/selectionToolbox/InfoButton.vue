<template>
  <Button
    v-tooltip.top="{
      value: $t('g.info'),
      showDelay: 1000
    }"
    data-testid="info-button"
    text
    severity="secondary"
    @click="onInfoClick"
  >
    <i class="icon-[lucide--info] h-4 w-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useTelemetry } from '@/platform/telemetry'

const { showNodeHelp: toggleHelp } = useSelectionState()

/**
 * Track node info button click and toggle node help.
 */
const onInfoClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'selection_toolbox_node_info_opened'
  })
  toggleHelp()
}
</script>
