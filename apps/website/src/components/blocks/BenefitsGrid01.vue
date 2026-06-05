<script setup lang="ts">
import BrandButton from '../common/BrandButton.vue'
import GlassCard from '../common/GlassCard.vue'

type Benefit = { id: string; description: string }
type Cta = {
  label: string
  href: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

defineProps<{
  heading: string
  benefits: readonly Benefit[]
  primaryCta?: Cta
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="mb-12 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <GlassCard class="mx-auto max-w-7xl">
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="(benefit, index) in benefits"
          :key="benefit.id"
          class="flex flex-col gap-6 rounded-4xl bg-primary-comfy-ink p-6 lg:p-8"
        >
          <span
            class="text-primary-comfy-yellow font-mono text-sm font-bold tracking-wide"
          >
            {{ String(index + 1).padStart(2, '0') }}
          </span>
          <p
            class="text-base/relaxed font-medium text-primary-comfy-canvas lg:text-xl"
          >
            {{ benefit.description }}
          </p>
        </article>
      </div>
    </GlassCard>

    <div v-if="primaryCta" class="mt-10 flex justify-center lg:mt-12">
      <BrandButton
        :href="primaryCta.href"
        :target="primaryCta.target"
        size="lg"
        class="px-20 py-4 text-base uppercase"
        variant="outline"
      >
        {{ primaryCta.label }}
      </BrandButton>
    </div>
  </section>
</template>
