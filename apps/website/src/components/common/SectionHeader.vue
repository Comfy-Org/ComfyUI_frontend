<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SectionLabel from './SectionLabel.vue'

const {
  label,
  headingTag = 'h2',
  maxWidth = 'lg',
  headingSize = 'section'
} = defineProps<{
  label?: string
  headingTag?: 'h1' | 'h2' | 'h3'
  maxWidth?: 'md' | 'lg' | 'xl'
  headingSize?: 'section' | 'hero'
}>()

const maxWidthClass = {
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl'
} as const

const headingSizeClass = {
  section: 'text-3xl font-light lg:text-5xl/tight',
  hero: 'text-4xl/tight font-light md:text-5xl/tight lg:text-6xl/tight'
} as const
</script>

<template>
  <div :class="cn('mx-auto text-center', maxWidthClass[maxWidth])">
    <SectionLabel v-if="label">{{ label }}</SectionLabel>
    <component
      :is="headingTag"
      :class="
        cn(
          'text-primary-comfy-canvas',
          label && 'mt-4',
          headingSizeClass[headingSize]
        )
      "
    >
      <slot />
    </component>
    <slot name="subtitle" />
  </div>
</template>
