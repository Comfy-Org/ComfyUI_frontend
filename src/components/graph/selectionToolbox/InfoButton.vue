<template>
  <Button
    v-tooltip.top="{
      value: $t('g.info'),
      showDelay: 1000
    }"
    data-testid="info-button"
    text
    severity="secondary"
    @click="toggleHelp"
  >
    <i class="icon-[lucide--info] h-4 w-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useSelectionState } from '@/composables/graph/useSelectionState'

const { showNodeHelp: toggleHelp } = useSelectionState()
</script>
