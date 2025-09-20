<script setup lang="ts">
import Button from 'primevue/button'

import { useSelectionState } from '@/composables/graph/useSelectionState'

const { showNodeHelp: toggleHelp } = useSelectionState()
</script>

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
    <i-lucide:info class="w-4 h-4" />
  </Button>
</template>
