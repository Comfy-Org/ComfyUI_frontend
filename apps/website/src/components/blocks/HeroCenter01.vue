<script setup lang="ts">
import type { AnchorHTMLAttributes } from 'vue'

import Button from '../ui/button/Button.vue'

type Cta = {
  label: string
  href: string
  target?: AnchorHTMLAttributes['target']
  rel?: AnchorHTMLAttributes['rel']
}

type Visual = {
  src: string
  alt: string
  width?: number
  height?: number
}

const { visual, eyebrow, title, subtitle, primaryCta, secondaryCta } =
  defineProps<{
    visual?: Visual
    eyebrow?: string
    title: string
    subtitle?: string
    primaryCta: Cta
    secondaryCta?: Cta
  }>()

function resolveRel(cta: Cta): AnchorHTMLAttributes['rel'] {
  return (
    cta.rel ?? (cta.target === '_blank' ? 'noopener noreferrer' : undefined)
  )
}
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 py-16 text-center lg:py-24"
  >
    <img
      v-if="visual"
      :src="visual.src"
      :alt="visual.alt"
      :width="visual.width"
      :height="visual.height"
      fetchpriority="high"
      decoding="async"
      class="mb-10 h-auto w-full max-w-md lg:mb-12 lg:max-w-lg"
    />

    <p
      v-if="eyebrow"
      class="mb-4 text-sm font-medium tracking-wide text-primary-comfy-canvas/70 uppercase"
    >
      {{ eyebrow }}
    </p>

    <h1
      class="max-w-3xl text-4xl/tight font-light tracking-tight text-pretty text-primary-comfy-canvas lg:text-6xl"
    >
      {{ title }}
    </h1>

    <p
      v-if="subtitle"
      class="mt-6 max-w-2xl text-base text-primary-comfy-canvas/70 lg:text-lg"
    >
      {{ subtitle }}
    </p>

    <div class="mt-10 flex flex-col gap-4 sm:flex-row lg:mt-12">
      <Button
        as="a"
        :href="primaryCta.href"
        :target="primaryCta.target"
        :rel="resolveRel(primaryCta)"
        size="lg"
      >
        {{ primaryCta.label }}
      </Button>
      <Button
        v-if="secondaryCta"
        as="a"
        :href="secondaryCta.href"
        :target="secondaryCta.target"
        :rel="resolveRel(secondaryCta)"
        variant="outline"
        size="lg"
      >
        {{ secondaryCta.label }}
      </Button>
    </div>
  </section>
</template>
