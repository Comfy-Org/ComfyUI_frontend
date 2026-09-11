<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import SectionHeader from '../common/SectionHeader.vue'

const {
  eyebrow,
  heading,
  subtitle,
  headingTag,
  maxWidth,
  class: className
} = defineProps<{
  eyebrow?: string
  heading: string
  subtitle?: string
  headingTag?: 'h1' | 'h2' | 'h3'
  maxWidth?: 'md' | 'lg' | 'xl'
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <SectionHeader
      :label="eyebrow"
      :heading-tag="headingTag"
      :max-width="maxWidth"
    >
      {{ heading }}
      <template v-if="subtitle" #subtitle>
        <p
          class="mx-auto mt-6 max-w-2xl text-base/relaxed font-light text-primary-comfy-canvas/75 lg:text-lg/relaxed"
        >
          {{ subtitle }}
        </p>
      </template>
    </SectionHeader>
  </section>
</template>
