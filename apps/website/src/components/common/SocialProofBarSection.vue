<script setup lang="ts">
const logos = [
  'Amazon Studios',
  'Apple',
  'Autodesk',
  'EA',
  'Harman',
  'Hp',
  'Lucid',
  'Netflix',
  'Nike',
  'Pixomondo',
  'Tencent',
  'Ubisoft'
]

const mobileRow1Logos = logos.slice(0, 6)
const mobileRow2Logos = logos.slice(6)
</script>

<template>
  <section class="overflow-hidden py-12">
    <!-- Single row on desktop -->
    <div data-testid="social-proof-desktop" class="hidden w-max gap-2 md:flex">
      <div
        v-for="copy in 2"
        :key="copy"
        class="animate-marquee flex shrink-0 items-center gap-2"
        style="--marquee-gap: 0.5rem"
        :aria-hidden="copy === 2 ? 'true' : undefined"
      >
        <div
          v-for="logo in logos"
          :key="logo"
          class="flex h-20 w-50 shrink-0 items-center justify-center"
        >
          <img :src="`/icons/clients/${logo}.svg`" :alt="logo" />
        </div>
      </div>
    </div>

    <!-- Two rows on mobile -->
    <div
      data-testid="social-proof-mobile"
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
            :key="logo"
            class="flex h-14 w-40 shrink-0 items-center justify-center"
          >
            <img :src="`/icons/clients/${logo}.svg`" :alt="logo" />
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
            :key="logo"
            class="flex h-14 w-40 shrink-0 items-center justify-center"
          >
            <img :src="`/icons/clients/${logo}.svg`" :alt="logo" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
