<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

export type SplitImage = { src: string; alt: string }

/*
 * `imagePosition` reorders the columns from lg up only: stacked, the text always
 * leads so a flipped section never opens with an unlabelled screenshot.
 */
const { imagePosition = 'right', class: className } = defineProps<{
  id?: string
  heading: string
  body: string
  image: SplitImage
  imagePosition?: 'left' | 'right'
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <section
    :id
    :class="
      cn(
        'max-w-9xl mx-auto px-6 py-16 lg:flex lg:items-center lg:gap-6 lg:px-20 lg:py-24',
        className
      )
    "
  >
    <div
      :class="
        cn(
          'lg:w-111 lg:shrink-0',
          imagePosition === 'left' ? 'lg:order-2' : 'lg:order-1'
        )
      "
    >
      <h2
        class="text-page-fg lg:text-6.5xl/tight text-4xl/tight font-medium tracking-[-0.03em] whitespace-pre-line md:text-5xl/tight"
      >
        {{ heading }}
      </h2>
      <p
        class="text-page-fg mt-8 text-[17px] leading-[1.6] font-light whitespace-pre-line lg:mt-12"
      >
        {{ body }}
      </p>
    </div>

    <!-- Tinted and aspect-fixed so a slow or missing asset holds the layout. -->
    <div
      :class="
        cn(
          'bg-page-fg/5 mt-10 aspect-956/469 overflow-hidden rounded-[26px] lg:mt-0 lg:flex-1',
          imagePosition === 'left' ? 'lg:order-1' : 'lg:order-2'
        )
      "
    >
      <img
        :src="image.src"
        :alt="image.alt"
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
      />
    </div>
  </section>
</template>
