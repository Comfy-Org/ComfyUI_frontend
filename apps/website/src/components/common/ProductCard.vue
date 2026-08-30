<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import Button from '../ui/button/Button.vue'

type Tone = 'dark' | 'light'

const TONES = {
  dark: {
    card: '',
    title: 'text-3xl text-white lg:text-4xl',
    description: 'mt-auto pt-16 text-sm text-white/70',
    ctaVariant: 'default',
    ctaSize: 'sm',
    cta: 'mt-4 h-auto self-start whitespace-normal'
  },
  light: {
    // The subgrid aligns descriptions and CTAs across the row. It inherits the
    // parent's row gap, so the hosting grid must set `lg:gap-y-0`.
    card: 'bg-primary-comfy-ink/8 lg:grid lg:grid-cols-1 lg:grid-rows-subgrid lg:row-span-3 pt-12',
    title:
      'text-primary-comfy-plum text-3xl lg:text-[2.5rem] lg:leading-[1.25] lg:tracking-[-0.03em]',
    // `mb-9`, not `mt-9` on the CTA, so `mt-auto` stays free to bottom-align it.
    description:
      'mt-2 mb-9 text-primary-comfy-ink text-[17px] leading-[1.6] font-light',
    ctaVariant: 'outline',
    ctaSize: 'default',
    cta: 'border-primary-comfy-ink text-primary-comfy-ink hover:bg-primary-comfy-ink hover:text-primary-warm-white mt-auto h-12 self-start justify-self-start border-2'
  }
} as const

const {
  title,
  description,
  cta,
  href,
  bg,
  tone = 'dark'
} = defineProps<{
  title: string
  description: string
  cta: string
  href: string
  /** Background utility class. The `light` tone brings its own. */
  bg?: string
  tone?: Tone
}>()

// The CTA is the card's only link, so "Try now" alone would name every card in
// the row identically.
const linkLabel = computed(() => `${cta}: ${title.replace(/\n/g, ' ')}`)
</script>

<template>
  <div
    :class="
      cn(
        'rounded-4.5xl relative flex flex-col justify-between p-8 transition-opacity hover:opacity-90',
        TONES[tone].card,
        bg
      )
    "
  >
    <h3 :class="cn('font-light whitespace-pre-line', TONES[tone].title)">
      {{ title }}
    </h3>

    <p :class="TONES[tone].description">
      {{ description }}
    </p>

    <Button
      :href="href"
      :aria-label="linkLabel"
      :variant="TONES[tone].ctaVariant"
      :size="TONES[tone].ctaSize"
      :class="TONES[tone].cta"
    >
      {{ cta }}
      <template #append>
        <span class="absolute inset-0" aria-hidden="true" />
      </template>
    </Button>
  </div>
</template>
