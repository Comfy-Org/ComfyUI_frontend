<template>
  <Button
    ref="buttonRef"
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
import { ref } from 'vue'

import { toggleNodeOptions } from '@/composables/graph/useMoreOptionsMenu'

const buttonRef = ref<InstanceType<typeof Button> | null>(null)

const handleClick = (event: Event) => {
  const el = (buttonRef.value as any)?.$el || buttonRef.value
  const buttonEl = el instanceof HTMLElement ? el : null
  if (buttonEl) {
    toggleNodeOptions(event, buttonEl, true)
  }
}
</script>
