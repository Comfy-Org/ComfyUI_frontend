<script setup lang="ts">
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
</script>

<template>
  <section class="py-12 md:py-24">
    <div
      class="flex gap-4 overflow-x-auto px-6 md:gap-6 md:px-20"
      style="scrollbar-width: none"
    >
      <div
        v-for="(photo, i) in photos"
        :key="i"
        class="aspect-3/4 h-64 shrink-0 md:h-96"
      >
        <img
          :src="photo.src"
          :alt="photo.alt"
          class="size-full rounded-2xl object-cover md:rounded-3xl"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  </section>
</template>
