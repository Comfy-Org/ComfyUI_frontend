<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { label, notch = false } = defineProps<{
  label: string
  notch?: boolean
}>()

const on = defineModel<boolean>({ default: false })
</script>

<template>
  <div
    class="relative flex h-[1.625em] items-center justify-between text-[0.75em]"
  >
    <span
      v-if="notch"
      class="bg-primary-comfy-ink-light absolute top-1/2 left-[-0.85em] h-[0.85em] w-[0.35em] -translate-y-1/2 rounded-[0.2em] border border-white/25"
    />
    <span class="text-white/60">{{ label }}</span>
    <button
      type="button"
      role="switch"
      :aria-checked="on"
      :aria-label="label"
      :class="
        cn(
          'relative h-[1em] w-[1.875em] cursor-pointer rounded-full',
          on ? 'bg-[#4a90d9]' : 'border border-white/10 bg-black/40'
        )
      "
      @click="on = !on"
    >
      <span
        :class="
          cn(
            'absolute top-1/2 right-[0.125em] size-[0.7em] -translate-y-1/2 rounded-full',
            on ? 'bg-primary-comfy-ink' : 'bg-white/35'
          )
        "
      />
    </button>
  </div>
</template>
