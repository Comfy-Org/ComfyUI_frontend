<script setup lang="ts">
import GlassCard from '../common/GlassCard.vue'
import Button from '../ui/button/Button.vue'
import { resolveRel } from '../../utils/cta'

type Benefit = { id: string; title?: string; description: string }
type Cta = {
  label: string
  href: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

withDefaults(
  defineProps<{
    heading: string
    benefits: readonly Benefit[]
    columns?: 2 | 4
    numbered?: boolean
    contained?: boolean
    footnote?: string
    primaryCta?: Cta
    secondaryCta?: Cta
  }>(),
  { columns: 4, numbered: true, contained: true }
)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <h2
      class="mb-12 text-center text-4xl font-light tracking-tight text-primary-comfy-canvas lg:mb-16 lg:text-6xl"
    >
      {{ heading }}
    </h2>

    <component :is="contained ? GlassCard : 'div'" class="mx-auto max-w-7xl">
      <div
        :class="[
          'grid grid-cols-1',
          contained ? 'gap-2' : 'gap-4 lg:gap-6',
          'md:grid-cols-2',
          columns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-4'
        ]"
      >
        <article
          v-for="(benefit, index) in benefits"
          :key="benefit.id"
          :class="[
            'flex flex-col gap-6 rounded-4xl',
            contained
              ? 'bg-primary-comfy-ink p-6 lg:p-8'
              : 'bg-primary-comfy-ink-light p-8 lg:p-12'
          ]"
        >
          <span
            v-if="numbered"
            class="text-primary-comfy-yellow font-mono text-sm font-bold tracking-wide"
          >
            {{ String(index + 1).padStart(2, '0') }}
          </span>
          <h3
            v-if="benefit.title"
            class="text-2xl font-normal text-primary-warm-white"
          >
            {{ benefit.title }}
          </h3>
          <p
            :class="
              benefit.title
                ? 'text-base/relaxed font-light text-primary-comfy-canvas'
                : 'text-base/relaxed font-medium text-primary-comfy-canvas lg:text-xl'
            "
          >
            {{ benefit.description }}
          </p>
        </article>
      </div>
    </component>

    <p
      v-if="footnote"
      class="mt-10 text-center text-sm font-light text-primary-comfy-canvas lg:mt-12"
    >
      {{ footnote }}
    </p>

    <div
      v-if="primaryCta"
      class="mt-10 flex flex-col justify-center gap-4 sm:flex-row lg:mt-12"
    >
      <Button
        as="a"
        :href="primaryCta.href"
        :target="primaryCta.target"
        :rel="resolveRel(primaryCta)"
        variant="outline"
        size="lg"
        class="px-20"
      >
        {{ primaryCta.label }}
      </Button>
      <Button
        v-if="secondaryCta"
        as="a"
        :href="secondaryCta.href"
        :target="secondaryCta.target"
        :rel="resolveRel(secondaryCta)"
        variant="default"
        size="lg"
        class="px-20"
      >
        {{ secondaryCta.label }}
      </Button>
    </div>
  </section>
</template>
