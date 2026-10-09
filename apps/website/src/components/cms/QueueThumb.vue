<script setup lang="ts">
import { Workflow } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

const { src, class: className } = defineProps<{
  src?: string
  class?: string
}>()
</script>

<template>
  <span
    :class="
      cn(
        'grid aspect-3/2 shrink-0 place-items-center overflow-hidden rounded-lg bg-transparency-white-t8 text-primary-warm-gray',
        className
      )
    "
    aria-hidden="true"
  >
    <img v-if="src" :src alt="" class="size-full object-cover" loading="lazy" />
    <Workflow v-else class="size-5" />
  </span>
</template>
