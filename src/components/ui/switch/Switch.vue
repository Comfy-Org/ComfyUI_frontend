<template>
  <SwitchRoot
    v-model="checked"
    :disabled
    :class="
      cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-interface-stroke',
        customClass
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-3.5' : 'translate-x-0'
        )
      "
    />
  </SwitchRoot>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { disabled = false, class: customClass = '' } = defineProps<{
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()
const checked = defineModel<boolean>({ default: false })
</script>
