<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const photos = [
  {
    src: 'https://media.comfy.org/website/careers/team0.webp',
    alt: 'Team dinner'
  },
  {
    src: 'https://media.comfy.org/website/careers/team1.webp',
    alt: 'Team working'
  },
  {
    src: 'https://media.comfy.org/website/careers/team2.webp',
    alt: 'Team offsite'
  },
  {
    src: 'https://media.comfy.org/website/careers/team3.webp',
    alt: 'Team on a boat'
  },
  {
    src: 'https://media.comfy.org/website/careers/team4.webp',
    alt: 'Teammates posing at a restaurant'
  },
  {
    src: 'https://media.comfy.org/website/careers/team5.webp',
    alt: 'Teammates at a social gathering'
  },
  {
    src: 'https://media.comfy.org/website/careers/team6.webp',
    alt: 'Team sailing at golden hour'
  },
  {
    src: 'https://media.comfy.org/website/careers/team7.webp',
    alt: 'Team on a sailboat at sunset'
  }
]

const strips = [
  { id: 'strip', class: 'flex', ariaHidden: undefined },
  { id: 'loop', class: 'hidden motion-safe:flex', ariaHidden: 'true' }
] as const
</script>

<template>
  <section class="py-12 md:py-24">
    <div
      data-testid="careers-team-photos"
      class="group flex gap-4 overflow-x-auto px-6 motion-safe:overflow-hidden motion-safe:px-0 md:gap-6 md:px-20 motion-safe:md:px-0"
      style="scrollbar-width: none"
    >
      <div
        v-for="strip in strips"
        :key="strip.id"
        :data-testid="`careers-team-photos-${strip.id}`"
        :class="
          cn(
            strip.class,
            'shrink-0 gap-4 [--marquee-gap:1rem] md:gap-6 md:[--marquee-gap:1.5rem]',
            'group-hover:paused motion-safe:animate-marquee motion-safe:animation-duration-[40s]'
          )
        "
        :aria-hidden="strip.ariaHidden"
      >
        <div
          v-for="photo in photos"
          :key="photo.src"
          class="aspect-3/4 h-64 shrink-0 md:h-96"
        >
          <img
            :src="photo.src"
            :alt="strip.id === 'strip' ? photo.alt : ''"
            class="size-full rounded-2xl object-cover md:rounded-3xl"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </div>
  </section>
</template>
