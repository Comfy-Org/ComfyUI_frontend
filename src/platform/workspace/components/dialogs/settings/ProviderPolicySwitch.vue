<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled
    :aria-label="label"
    class="group focus-visible:ring-ring relative flex h-10 w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent outline-hidden focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span
      :class="
        cn(
          'relative h-6 w-10 rounded-full transition-colors',
          modelValue
            ? 'bg-primary-background group-hover:bg-primary-background-hover'
            : 'bg-secondary-background group-hover:bg-secondary-background-hover'
        )
      "
    >
      <span
        :class="
          cn(
            'absolute top-1 left-1 size-4 rounded-full bg-base-foreground transition-transform',
            modelValue && 'translate-x-4'
          )
        "
      />
    </span>
  </button>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const {
  modelValue,
  disabled = false,
  label
} = defineProps<{
  modelValue: boolean
  disabled?: boolean
  label: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
