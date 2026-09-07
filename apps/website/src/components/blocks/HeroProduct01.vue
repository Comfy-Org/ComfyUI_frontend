<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import BrandButton from '../common/BrandButton.vue'

type Cta = {
  label: string
  href: string
  target?: '_blank' | '_self' | '_parent' | '_top'
}

const {
  headingTag = 'h1',
  title,
  tag,
  body,
  primaryCta,
  secondaryCta,
  imageSrc,
  imageAlt = '',
  imageWidth = 800,
  imageHeight = 596,
  class: className
} = defineProps<{
  headingTag?: 'h1' | 'h2'
  title: string
  tag?: string
  body?: string
  primaryCta: Cta
  secondaryCta?: Cta
  imageSrc?: string
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :class="
      cn(
        'max-w-9xl relative mx-auto flex flex-col items-center gap-12 overflow-x-clip px-6 pt-20 pb-16 md:pt-28 md:pb-24 lg:flex-row lg:gap-8 lg:px-16',
        className
      )
    "
  >
    <div class="w-full lg:flex-1">
      <component
        :is="headingTag"
        class="font-formula-narrow flex h-12 items-stretch font-semibold **:select-none md:h-20"
      >
        <img
          src="/icons/node-left.svg"
          alt=""
          class="-mx-px h-full w-auto"
          aria-hidden="true"
        />
        <span
          class="bg-primary-comfy-yellow flex items-center px-1 text-primary-comfy-ink"
        >
          <span
            class="inline-block translate-y-0.5 text-3xl font-bold tracking-[-0.03em] whitespace-nowrap md:text-[2.5rem]"
          >
            {{ title }}
          </span>
        </span>
        <template v-if="tag">
          <img
            src="/icons/node-union-2size.svg"
            alt=""
            class="-mx-px h-full w-auto"
            aria-hidden="true"
          />
          <span
            class="bg-primary-comfy-yellow flex h-7 items-center self-center px-1.5 text-primary-comfy-ink md:h-12 md:px-2"
          >
            <span
              class="inline-block translate-y-0.5 text-lg font-bold whitespace-nowrap md:text-3xl"
            >
              {{ tag }}
            </span>
          </span>
          <img
            src="/icons/node-right.svg"
            alt=""
            class="-mx-px h-7 w-auto self-center md:h-12"
            aria-hidden="true"
          />
        </template>
        <img
          v-else
          src="/icons/node-right.svg"
          alt=""
          class="-mx-px h-full w-auto"
          aria-hidden="true"
        />
      </component>

      <p
        v-if="body"
        class="mt-8 max-w-xl text-base text-primary-comfy-canvas md:mt-12"
      >
        {{ body }}
      </p>

      <div class="mt-10 flex flex-col gap-4 sm:flex-row md:mt-16">
        <BrandButton
          :href="primaryCta.href"
          :target="primaryCta.target"
          size="lg"
          class="min-h-16 min-w-40 rounded-3xl px-8 uppercase"
        >
          {{ primaryCta.label }}
        </BrandButton>
        <BrandButton
          v-if="secondaryCta"
          :href="secondaryCta.href"
          :target="secondaryCta.target"
          variant="outline"
          size="lg"
          class="min-h-16 min-w-40 rounded-3xl px-8 uppercase"
        >
          {{ secondaryCta.label }}
        </BrandButton>
      </div>
    </div>

    <div
      class="pointer-events-none order-first w-full max-w-xl lg:order-last lg:flex-1 lg:scale-125"
    >
      <slot name="media">
        <img
          v-if="imageSrc"
          :src="imageSrc"
          :alt="imageAlt"
          :width="imageWidth"
          :height="imageHeight"
          fetchpriority="high"
          decoding="async"
          class="w-full"
        />
      </slot>
    </div>
  </section>
</template>
