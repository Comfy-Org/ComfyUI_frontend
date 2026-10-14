<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

const {
  playing = false,
  size = 'md',
  variant = 'solid'
} = defineProps<{
  playing?: boolean
  size?: 'sm' | 'md'
  /** `overlay` is the squircle for video posters and ignores `size`. */
  variant?: 'solid' | 'overlay' | 'muted'
}>()

const buttonClass = computed(() =>
  cn(
    'flex shrink-0 cursor-pointer items-center justify-center transition-colors',
    size === 'sm' ? 'size-8 rounded-lg lg:size-10' : 'size-12 rounded-xl',
    variant === 'muted' && !playing
      ? 'bg-transparency-white-t8 text-primary-warm-white hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
      : 'bg-primary-comfy-yellow text-primary-comfy-ink'
  )
)

const glyphClass = computed(() =>
  size === 'sm' ? 'size-3 lg:size-4' : 'size-4'
)
</script>

<template>
  <button
    v-if="variant === 'overlay'"
    type="button"
    class="flex size-16 shrink-0 cursor-pointer items-center justify-center rounded-[45%] bg-white/8 backdrop-blur-[9px] transition-colors hover:bg-white/15 lg:size-24"
  >
    <svg class="size-full" viewBox="0 0 96 96" fill="white" aria-hidden="true">
      <template v-if="playing">
        <rect x="35" y="31" width="9" height="34" rx="4" />
        <rect x="52" y="31" width="9" height="34" rx="4" />
      </template>
      <path
        v-else
        d="M38.5056 32.9019C38.5056 31.3349 40.2474 30.3959 41.5565 31.2572L64.5056 46.3556C65.6877 47.1334 65.6878 48.8671 64.5056 49.6449L41.5565 64.7433C40.2476 65.6043 38.506 64.6653 38.5056 63.0986V32.9019Z"
      />
    </svg>
  </button>
  <button v-else type="button" :class="buttonClass">
    <svg
      v-if="playing"
      :class="glyphClass"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
    <svg
      v-else
      :class="cn('ml-0.5', glyphClass)"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  </button>
</template>
