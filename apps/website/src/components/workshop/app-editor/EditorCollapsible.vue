<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { ref, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { title, initiallyOpen = false } = defineProps<{
  title: string
  initiallyOpen?: boolean
}>()

const open = ref(initiallyOpen)
const id = useId()
</script>

<template>
  <section :aria-label="title" class="flex flex-col">
    <h2 class="m-0">
      <button
        type="button"
        :aria-expanded="open"
        :aria-controls="id"
        class="flex h-10 w-full items-center justify-between rounded-md px-1 text-[11px] font-medium tracking-wider text-primary-warm-gray uppercase transition hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="open = !open"
      >
        {{ title }}
        <ChevronDown
          :class="cn('size-3.5 transition-transform', open && 'rotate-180')"
          aria-hidden="true"
        />
      </button>
    </h2>
    <div v-if="open" :id class="flex flex-col gap-2.5 pb-4">
      <slot />
    </div>
  </section>
</template>
