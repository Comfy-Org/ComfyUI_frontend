<script setup lang="ts">
import type { SwitchRootEmits } from 'reka-ui'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  class: customClass = '',
  disabled = false,
  modelValue = false,
  readonly = false
} = defineProps<{
  class?: HTMLAttributes['class']
  disabled?: boolean
  modelValue?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<SwitchRootEmits>()

function updateModelValue(value: boolean) {
  if (readonly) return
  emit('update:modelValue', value)
}
</script>

<template>
  <SwitchRoot
    :model-value
    :disabled
    :aria-readonly="readonly || undefined"
    :class="
      cn(
        'group inline-flex h-6 w-10 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full border-0 bg-transparent p-0 transition-shadow outline-none focus-visible:ring-1 focus-visible:ring-border-default disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-readonly:cursor-default',
        customClass
      )
    "
    @update:model-value="updateModelValue"
  >
    <span
      class="pointer-events-none inline-flex h-5 w-9 items-center rounded-full border border-transparent bg-interface-stroke px-0.5 transition-colors group-data-[state=checked]:bg-primary-background"
    >
      <SwitchThumb
        class="pointer-events-none block size-4 rounded-full bg-base-background shadow-sm transition-transform data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0"
      />
    </span>
  </SwitchRoot>
</template>
