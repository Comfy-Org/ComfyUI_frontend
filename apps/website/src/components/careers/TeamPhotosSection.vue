<script setup lang="ts">
import { onMounted, ref } from 'vue'

const photos = [
  { src: '/images/careers/team0.webp', alt: 'Team dinner' },
  { src: '/images/careers/team1.webp', alt: 'Team working' },
  { src: '/images/careers/team2.webp', alt: 'Team offsite' },
  { src: '/images/careers/team3.webp', alt: 'Team on a boat' }
]

const loopedPhotos = [...photos, ...photos, ...photos]

const scrollRef = ref<HTMLElement>()

function onScroll() {
  const el = scrollRef.value
  if (!el) return

  const third = el.scrollWidth / 3
  const maxScroll = el.scrollWidth - el.clientWidth

  if (el.scrollLeft >= maxScroll - 1) {
    el.scrollLeft -= third
  } else if (el.scrollLeft <= 1) {
    el.scrollLeft += third
  }
}

onMounted(() => {
  const el = scrollRef.value
  if (el) {
    el.scrollLeft = el.scrollWidth / 3
  }
})
</script>

<template>
  <section class="py-12 md:py-24">
    <div
      ref="scrollRef"
      class="flex gap-4 overflow-x-auto px-6 md:gap-6 md:px-20"
      style="scrollbar-width: none"
      @scroll="onScroll"
    >
      <div
        v-for="(photo, i) in loopedPhotos"
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
