<script setup lang="ts">
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

const { heading, primaryCta, secondaryCta, termsLink } = defineProps<{
  heading: string
  primaryCta: Cta
  secondaryCta?: Cta
  termsLink?: TermsLink
}>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 py-16 text-center lg:py-24"
  >
    <h2
      class="max-w-3xl text-4xl/snug font-light tracking-tight text-pretty text-primary-comfy-canvas lg:text-6xl/snug"
    >
      {{ heading }}
    </h2>

    <div class="mt-10 flex flex-col gap-4 sm:flex-row lg:mt-12">
      <Button
        as="a"
        :href="primaryCta.href"
        :target="primaryCta.target"
        :rel="resolveRel(primaryCta)"
        variant="default"
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

    <a
      v-if="termsLink"
      :href="termsLink.href"
      class="mt-8 text-sm text-primary-comfy-canvas/70 underline underline-offset-4 transition-colors hover:text-primary-comfy-canvas"
    >
      {{ termsLink.label }}
    </a>
  </section>
</template>
