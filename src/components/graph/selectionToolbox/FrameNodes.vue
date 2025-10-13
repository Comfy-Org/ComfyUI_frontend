<template>
  <Button
    v-tooltip.top="{
      value: $t('g.frameNodes'),
      showDelay: 1000
    }"
    class="frame-nodes-button"
    text
    severity="secondary"
    @click="frameNodes"
  >
    <i class="icon-[lucide--frame] h-4 w-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useFrameNodes } from '@/composables/graph/useFrameNodes'

const { frameNodes } = useFrameNodes()
</script>
