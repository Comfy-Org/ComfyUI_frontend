<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import Button from '../ui/button/Button.vue'
import { resolveRel } from '../../utils/cta'

type Cta = {
  label: string
  href: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

/*
 * The subbrand hero inverts the site's yellow buttons: ink fill with yellow
 * text, and an ink outline beside it. `buttonVariants` carries no such pair,
 * so the palette is set here and `cn` merges it over the variant.
 */
const CTA_BASE = 'h-16 rounded-3xl px-8 text-sm'
const CTA_PRIMARY = `${CTA_BASE} bg-primary-comfy-ink text-primary-comfy-yellow hover:bg-primary-comfy-ink/90`
const CTA_SECONDARY = `${CTA_BASE} border-2 border-primary-comfy-ink text-primary-comfy-ink hover:bg-primary-comfy-ink hover:text-primary-comfy-yellow`

const {
  title,
  lead,
  primaryCta,
  secondaryCta,
  footnote,
  class: className
} = defineProps<{
  title: string
  lead: string
  primaryCta: Cta
  secondaryCta?: Cta
  footnote?: string
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="
      cn(
        // The copy column is the wider of the two (design: 671px vs 588px),
        // which is what keeps the headline on one line at full width.
        'max-w-9xl mx-auto flex flex-col gap-12 px-6 py-16 lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-20 lg:px-20 lg:py-24',
        className
      )
    "
  >
    <div class="w-full">
      <h1
        class="text-page-fg lg:text-6.5xl text-4xl leading-[1.3] font-medium tracking-[-0.03em] text-pretty md:text-5xl"
      >
        {{ title }}
      </h1>

      <!-- Figma trims its text boxes to cap height, so the design's 48px /
           38px gaps are measured ink-to-ink. These margins are those gaps
           less the half-leading CSS adds above each block. -->
      <p class="text-page-fg mt-8 text-[17px] leading-[1.6] font-light">
        {{ lead }}
      </p>

      <div class="mt-8 flex flex-col gap-5 sm:flex-row">
        <!-- Button does not derive rel from target the way BrandButton did,
             so external CTAs get their safe rel here. -->
        <Button
          :href="primaryCta.href"
          :target="primaryCta.target"
          :rel="resolveRel({ target: primaryCta.target })"
          size="lg"
          :class="CTA_PRIMARY"
        >
          {{ primaryCta.label }}
        </Button>
        <Button
          v-if="secondaryCta"
          :href="secondaryCta.href"
          :target="secondaryCta.target"
          :rel="resolveRel({ target: secondaryCta.target })"
          variant="outline"
          size="lg"
          :class="CTA_SECONDARY"
        >
          {{ secondaryCta.label }}
        </Button>
      </div>

      <p v-if="footnote" class="text-page-fg mt-6 text-xs leading-[1.45]">
        {{ footnote }}
      </p>
    </div>

    <div class="w-full">
      <slot name="panel" />
    </div>
  </section>
</template>
