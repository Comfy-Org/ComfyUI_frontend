<template>
  <SwitchRoot
    v-model="checked"
    :disabled
    :class="
      cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-secondary-background'
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block size-4 rounded-full bg-base-background shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0'
        )
      "
    />
  </SwitchRoot>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

import { cn } from '@comfyorg/tailwind-utils'

const { disabled = false } = defineProps<{ disabled?: boolean }>()
const checked = defineModel<boolean>({ default: false })
</script>
