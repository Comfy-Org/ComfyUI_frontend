<template>
  <Button
    v-show="nodeDef"
    v-tooltip.top="{
      value: $t('g.info'),
      showDelay: 1000
    }"
    class="help-button"
    text
    severity="secondary"
    @click="toggleHelp"
  >
    <i-lucide:info class="w-4 h-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useSelectionState } from '@/composables/graph/useSelectionState'

const { nodeDef, showNodeHelp: toggleHelp } = useSelectionState()
</script>
