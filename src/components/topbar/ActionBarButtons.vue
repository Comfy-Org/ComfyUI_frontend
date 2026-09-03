<template>
  <div
    data-testid="action-bar-buttons"
    class="flex h-full shrink-0 items-center gap-1 empty:hidden"
  >
    <Tooltip
      v-for="(button, index) in actionBarButtonStore.buttons"
      :key="index"
      :config="button.tooltip"
      side="bottom"
    >
      <Button
        :aria-label="button.tooltip || button.label"
        :class="button.class"
        variant="muted-textonly"
        size="sm"
        class="h-7 rounded-full"
        @click="button.onClick"
      >
        <i :class="button.icon" />
        <span v-if="!isMobile && button.label">{{ button.label }}</span>
      </Button>
    </Tooltip>
  </div>
</template>

<script lang="ts" setup>
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

import Button from '@/components/ui/button/Button.vue'
import { useActionBarButtonStore } from '@/stores/actionBarButtonStore'

const actionBarButtonStore = useActionBarButtonStore()

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('sm')
</script>
