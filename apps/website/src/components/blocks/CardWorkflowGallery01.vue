<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import CardWorkflow01 from './CardWorkflow01.vue'
import type { CardWorkflowItem } from './CardWorkflow01.vue'

const {
  title,
  titleAlign = 'start',
  items,
  class: className
} = defineProps<{
  title?: string
  titleAlign?: 'start' | 'center'
  items: CardWorkflowItem[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <h2
      v-if="title"
      class="text-3xl font-light tracking-tight text-primary-warm-white lg:text-5xl"
      :class="titleAlign === 'center' ? 'text-center' : undefined"
    >
      {{ title }}
    </h2>

    <div
      class="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3"
      :class="title ? 'mt-10 lg:mt-24' : undefined"
    >
      <CardWorkflow01
        v-for="item in items"
        :key="item.id"
        :item
        variant="compact"
      />
    </div>
  </section>
</template>
