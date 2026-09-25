<template>
  <Tooltip
    :config="{
      value: $t('g.info'),
      showDelay: 1000
    }"
    side="top"
  >
    <Button
      data-testid="info-button"
      variant="muted-textonly"
      :aria-label="$t('g.info')"
      @click="onInfoClick"
    >
      <i class="icon-[lucide--info]" />
    </Button>
  </Tooltip>
</template>

<script setup lang="ts">
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import Button from '@/components/ui/button/Button.vue'
import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useTelemetry } from '@/platform/telemetry'

const { openNodeInfo } = useSelectionState()

const onInfoClick = () => {
  if (!openNodeInfo()) return

  useTelemetry()?.trackUiButtonClicked({
    button_id: 'selection_toolbox_node_info_opened',
    element_group: 'selection_toolbox'
  })
}
</script>
