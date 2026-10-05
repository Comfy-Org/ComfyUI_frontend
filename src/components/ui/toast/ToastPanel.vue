<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const isExpanded = defineModel<boolean>('expanded', { default: false })

function toggle() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    :class="
      cn(
        'w-full max-w-3xl overflow-hidden rounded-lg border border-border-default bg-base-background shadow-lg transition-all duration-300',
        isExpanded ? 'sm:w-[max(400px,40vw)]' : 'sm:w-fit'
      )
    "
  >
    <div
      :class="
        cn(
          'max-w-full min-w-0 overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-100 w-full' : 'max-h-0 w-0'
        )
      "
    >
      <slot :is-expanded />
    </div>

    <slot name="footer" :is-expanded :toggle />
  </div>
</template>
