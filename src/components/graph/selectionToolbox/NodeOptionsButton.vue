<template>
  <Button
    v-tooltip.top="{
      value: $t('g.moreOptions'),
      showDelay: 1000
    }"
    data-testid="more-options-button"
    text
    class="h-8 w-8 px-0"
    severity="secondary"
    @click="handleClick"
  >
    <i class="icon-[lucide--more-vertical] h-4 w-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { toggleNodeOptions } from '@/composables/graph/useMoreOptionsMenu'

const handleClick = (event: Event) => {
  toggleNodeOptions(event)
}
</script>
