<script setup lang="ts">
import { computed } from 'vue'

export interface LogoItem {
  src: string
  alt: string
}

const { logos, testId = 'logos-all' } = defineProps<{
  logos: readonly LogoItem[]
  testId?: string
}>()

// On mobile the single row splits into two counter-scrolling halves.
const mobileRow1Logos = computed(() =>
  logos.slice(0, Math.ceil(logos.length / 2))
)
const mobileRow2Logos = computed(() => logos.slice(Math.ceil(logos.length / 2)))
</script>

<template>
  <section class="overflow-hidden py-12">
    <!-- Single row on desktop -->
    <div :data-testid="`${testId}-desktop`" class="hidden w-max gap-2 md:flex">
      <div
        v-for="copy in 2"
        :key="copy"
        class="animate-marquee flex shrink-0 items-center gap-2"
        style="--marquee-gap: 0.5rem"
        :aria-hidden="copy === 2 ? 'true' : undefined"
      >
        <div
          v-for="logo in logos"
          :key="logo.src"
          class="flex h-20 w-50 shrink-0 items-center justify-center"
        >
          <img :src="logo.src" :alt="logo.alt" />
        </div>
      </div>
    </div>

    <!-- Two rows on mobile -->
    <div
      :data-testid="`${testId}-mobile`"
      class="flex flex-col gap-8 md:hidden"
    >
      <div class="flex w-max gap-8">
        <div
          v-for="copy in 2"
          :key="copy"
          class="animate-marquee flex shrink-0 items-center gap-8"
          style="--marquee-gap: 2rem"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <div
            v-for="logo in mobileRow1Logos"
            :key="logo.src"
            class="flex h-14 w-40 shrink-0 items-center justify-center"
          >
            <img :src="logo.src" :alt="logo.alt" />
          </div>
        </div>
      </div>
      <div class="flex w-max gap-8">
        <div
          v-for="copy in 2"
          :key="copy"
          class="animate-marquee-reverse flex shrink-0 items-center gap-8"
          style="--marquee-gap: 2rem"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <div
            v-for="logo in mobileRow2Logos"
            :key="logo.src"
            class="flex h-14 w-40 shrink-0 items-center justify-center"
          >
            <img :src="logo.src" :alt="logo.alt" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
