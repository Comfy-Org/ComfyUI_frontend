<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { AnchorHTMLAttributes } from 'vue'

import Button from '../ui/button/Button.vue'
import { resolveRel } from '../../utils/cta'

type Cta = {
  label: string
  href: string
  target?: AnchorHTMLAttributes['target']
  rel?: AnchorHTMLAttributes['rel']
}

type TermsLink = {
  label: string
  href: string
}

const {
  heading,
  subtitle,
  subtitleClass,
  primaryCta,
  secondaryCta,
  termsLink,
  compact = false
} = defineProps<{
  heading: string
  subtitle?: string
  subtitleClass?: string
  primaryCta: Cta
  secondaryCta?: Cta
  termsLink?: TermsLink
  compact?: boolean
}>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 py-16 text-center lg:py-24"
  >
    <h2
      :aria-label="heading"
      :class="
        cn(
          'max-w-3xl font-light tracking-tight text-pretty whitespace-pre-line text-primary-comfy-canvas',
          compact
            ? 'text-2xl/snug lg:text-4xl/snug'
            : 'text-4xl/snug lg:text-6xl/snug'
        )
      "
    >
      <slot name="heading">{{ heading }}</slot>
    </h2>

    <p
      v-if="subtitle"
      :class="
        cn(
          'mt-4 max-w-2xl text-base/relaxed font-light text-primary-comfy-canvas/80 lg:text-lg/relaxed',
          subtitleClass
        )
      "
    >
      {{ subtitle }}
    </p>

    <div class="mt-10 flex flex-col gap-4 sm:flex-row lg:mt-12">
      <Button
        as="a"
        :href="primaryCta.href"
        :target="primaryCta.target"
        :rel="resolveRel(primaryCta)"
        variant="default"
        :size="compact ? 'default' : 'lg'"
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
        :size="compact ? 'default' : 'lg'"
      >
        {{ secondaryCta.label }}
      </Button>
    </div>

    <a
      v-if="termsLink"
      :href="termsLink.href"
      class="mt-8 text-sm text-primary-comfy-canvas/70 underline underline-offset-4 transition-colors hover:text-primary-comfy-canvas"
    >
      {{ termsLink.label }}
    </a>
  </section>
</template>
