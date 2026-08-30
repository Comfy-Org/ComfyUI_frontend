<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { class: customClass = '', disabled = false } = defineProps<{
  class?: HTMLAttributes['class']
  disabled?: boolean
}>()

const modelValue = defineModel<boolean>({ default: false })
</script>

<template>
  <CheckboxRoot
    v-model="modelValue"
    :disabled
    :class="
      cn(
        'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-interface-stroke bg-transparent text-base-background transition-colors outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary-background data-[state=checked]:bg-primary-background',
        customClass
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <i class="icon-[lucide--check] size-3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
