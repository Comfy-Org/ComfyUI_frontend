<template>
  <div class="flex h-full shrink-0 items-center gap-1">
    <Button
      v-for="(button, index) in actionBarButtonStore.buttons"
      :key="index"
      v-tooltip.bottom="button.tooltip"
      :label="isMobile ? undefined : button.label"
      :aria-label="button.tooltip || button.label"
      :class="button.class"
      text
      rounded
      severity="secondary"
      class="h-7"
      @click="button.onClick"
    >
      <template #icon>
        <i :class="button.icon" />
      </template>
    </Button>
  </div>
</template>

<script lang="ts" setup>
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import Button from 'primevue/button'

import { useActionBarButtonStore } from '@/stores/actionBarButtonStore'

const actionBarButtonStore = useActionBarButtonStore()

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('sm')
</script>
