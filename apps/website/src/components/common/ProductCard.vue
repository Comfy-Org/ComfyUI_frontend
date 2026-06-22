<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { CtaButton } from '../../scripts/posthog'
import { captureCtaClick } from '../../scripts/posthog'

const { title, description, cta, href, bg, ctaButton } = defineProps<{
  title: string
  description: string
  cta: string
  href: string
  bg: string
  ctaButton?: CtaButton
}>()

function onClick() {
  if (ctaButton) captureCtaClick(ctaButton, 'products_section')
}
</script>

<template>
  <a
    :href="href"
    :class="
      cn(
        'rounded-4.5xl flex flex-col justify-between p-8 transition-opacity hover:opacity-90',
        bg
      )
    "
    @click="onClick"
  >
    <h3 class="text-3xl font-light whitespace-pre-line text-white lg:text-4xl">
      {{ title }}
    </h3>

    <div class="mt-auto pt-16">
      <p class="text-sm text-white/70">
        {{ description }}
      </p>
      <span
        class="bg-primary-comfy-yellow mt-4 inline-block rounded-xl px-4 py-2 text-xs font-bold tracking-wide text-primary-comfy-ink"
      >
        {{ cta }}
      </span>
    </div>
  </a>
</template>
