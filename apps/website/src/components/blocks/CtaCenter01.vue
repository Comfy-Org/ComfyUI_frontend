<script setup lang="ts">
import BrandButton from '../common/BrandButton.vue'

type Cta = {
  label: string
  href: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

type TermsLink = {
  label: string
  href: string
}

defineProps<{
  heading: string
  primaryCta: Cta
  termsLink: TermsLink
}>()
</script>

<template>
  <section
    class="max-w-9xl mx-auto flex flex-col items-center px-6 py-16 text-center lg:py-24"
  >
    <h2
      class="text-4xl font-light tracking-tight text-primary-comfy-canvas lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <BrandButton
      :href="primaryCta.href"
      :target="primaryCta.target"
      :rel="primaryCta.target === '_blank' ? 'noopener noreferrer' : undefined"
      variant="outline"
      size="lg"
      class="mt-10 px-20 py-4 text-base uppercase lg:mt-12"
    >
      {{ primaryCta.label }}
    </BrandButton>

    <a
      :href="termsLink.href"
      class="mt-8 text-sm text-primary-comfy-canvas/70 underline underline-offset-4 transition-colors hover:text-primary-comfy-canvas"
    >
      {{ termsLink.label }}
    </a>
  </section>
</template>
