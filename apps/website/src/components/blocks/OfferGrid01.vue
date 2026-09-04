<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { AnchorHTMLAttributes, HTMLAttributes } from 'vue'

import { resolveRel } from '../../utils/cta'
import GlassCard from '../common/GlassCard.vue'
import SectionHeader from '../common/SectionHeader.vue'
import Button from '../ui/button/Button.vue'

type Cta = {
  label: string
  href: string
  target?: AnchorHTMLAttributes['target']
  rel?: AnchorHTMLAttributes['rel']
}

interface OfferGridItem {
  id: string
  label?: string
  title: string
  description: string
  cta: Cta
}

type FeaturedOfferGridItem = Omit<OfferGridItem, 'label'> & {
  label?: string
}

const {
  eyebrow,
  heading,
  description,
  featuredOffer,
  offers,
  class: className
} = defineProps<{
  eyebrow?: string
  heading?: string
  description?: string
  featuredOffer?: FeaturedOfferGridItem
  offers: readonly OfferGridItem[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section :class="cn('max-w-9xl mx-auto px-6 py-16 lg:py-24', className)">
    <SectionHeader v-if="heading" :label="eyebrow" max-width="xl">
      {{ heading }}
      <template v-if="description" #subtitle>
        <p
          class="mx-auto mt-6 max-w-2xl text-base/relaxed font-light text-primary-comfy-canvas/75 lg:text-lg/relaxed"
        >
          {{ description }}
        </p>
      </template>
    </SectionHeader>

    <GlassCard class="mx-auto max-w-7xl" :class="heading && 'mt-12 lg:mt-16'">
      <div
        class="grid grid-cols-1 gap-2 md:grid-cols-2"
        :class="featuredOffer && 'xl:grid-cols-4 xl:grid-rows-2'"
      >
        <article
          v-if="featuredOffer"
          class="bg-primary-comfy-plum flex min-h-96 flex-col rounded-4xl p-8 md:col-span-2 lg:p-10 xl:row-span-2"
        >
          <p
            v-if="featuredOffer.label"
            class="text-primary-comfy-yellow text-xs font-bold tracking-[0.18em] uppercase"
          >
            {{ featuredOffer.label }}
          </p>
          <h3
            :class="
              cn(
                'max-w-2xl text-4xl font-light tracking-tight text-primary-warm-white lg:text-5xl',
                featuredOffer.label && 'mt-6'
              )
            "
          >
            {{ featuredOffer.title }}
          </h3>
          <p
            class="mt-5 max-w-xl text-base/relaxed font-light text-primary-comfy-canvas"
          >
            {{ featuredOffer.description }}
          </p>
          <div class="mt-auto pt-10">
            <Button
              as="a"
              :href="featuredOffer.cta.href"
              :target="featuredOffer.cta.target"
              :rel="resolveRel(featuredOffer.cta)"
              size="lg"
              class="w-full md:w-auto"
            >
              {{ featuredOffer.cta.label }}
            </Button>
          </div>
        </article>

        <article
          v-for="offer in offers"
          :key="offer.id"
          class="flex min-h-64 flex-col rounded-4xl bg-primary-comfy-ink p-8"
          :class="featuredOffer && 'last:md:col-span-2 last:xl:col-span-2'"
        >
          <p
            v-if="offer.label"
            class="text-primary-comfy-yellow text-xs font-bold tracking-[0.18em] uppercase"
          >
            {{ offer.label }}
          </p>
          <h3
            :class="
              cn(
                'text-2xl font-light tracking-tight text-primary-warm-white lg:text-3xl',
                offer.label && 'mt-5'
              )
            "
          >
            {{ offer.title }}
          </h3>
          <p
            class="mt-4 max-w-xl text-sm/relaxed font-light text-primary-comfy-canvas/75"
          >
            {{ offer.description }}
          </p>
          <div class="mt-auto pt-8">
            <Button
              as="a"
              :href="offer.cta.href"
              :target="offer.cta.target"
              :rel="resolveRel(offer.cta)"
              variant="outline"
              class="w-full md:w-auto"
            >
              {{ offer.cta.label }}
            </Button>
          </div>
        </article>
      </div>
    </GlassCard>
  </section>
</template>
