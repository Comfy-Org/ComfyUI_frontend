<template>
  <Button
    v-show="hasAnySelection"
    v-tooltip.top="{
      value: $t('g.frameNodes'),
      showDelay: 1000
    }"
    class="frame-nodes-button"
    text
    severity="secondary"
    @click="frameNodes"
  >
    <i-lucide:frame class="w-4 h-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useFrameNodes } from '@/composables/graph/useFrameNodes'
import { useSelectionState } from '@/composables/graph/useSelectionState'

const { hasAnySelection } = useSelectionState()
const { frameNodes } = useFrameNodes()
</script>
