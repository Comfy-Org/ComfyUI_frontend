<template>
  <Button
    v-tooltip.top="{
      value: $t('g.info'),
      showDelay: 1000
    }"
    data-testid="info-button"
    variant="muted-textonly"
    :aria-label="$t('g.info')"
    @click="onInfoClick"
  >
    <i class="icon-[lucide--info]" />
  </Button>
</template>

<script setup lang="ts">
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
