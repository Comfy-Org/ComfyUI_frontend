<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { ref, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  title,
  meta,
  initiallyOpen = false
} = defineProps<{
  title: string
  /** A short note beside the title, such as a count. */
  meta?: string
  initiallyOpen?: boolean
}>()

const open = ref(initiallyOpen)
const id = useId()
</script>

<template>
  <section
    :aria-label="title"
    class="flex flex-col border-t border-transparency-white-t8 first:border-t-0"
  >
    <h2 class="m-0">
      <button
        type="button"
        :aria-expanded="open"
        :aria-controls="id"
        class="flex h-12 w-full items-center gap-2 rounded-md px-1 text-left text-[13px] font-medium text-primary-warm-white transition hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="open = !open"
      >
        <span class="flex-1">{{ title }}</span>
        <span
          v-if="meta"
          class="text-xs font-normal text-primary-warm-gray tabular-nums"
          >{{ meta }}</span
        >
        <ChevronDown
          :class="
            cn(
              'size-4 text-primary-warm-gray transition-transform',
              open && 'rotate-180'
            )
          "
          aria-hidden="true"
        />
      </button>
    </h2>
    <div v-if="open" :id class="flex flex-col gap-2 pb-4">
      <slot />
    </div>
  </section>
</template>
