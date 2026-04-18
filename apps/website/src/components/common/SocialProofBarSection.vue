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

const desktopLogos = Array.from({ length: 4 }, () => logos).flat()
const row1 = logos.slice(0, 6)
const mobileRow1 = [...row1, ...row1]
const row2 = logos.slice(6)
const mobileRow2 = [...row2, ...row2]
</script>

<template>
  <section class="overflow-hidden py-12">
    <!-- Single row on desktop -->
    <div class="animate-marquee hidden items-center gap-2 md:flex">
      <div
        v-for="(logo, i) in desktopLogos"
        :key="`${logo}-${i}`"
        class="flex h-20 w-50 shrink-0 items-center justify-center"
      >
        <img :src="`/icons/clients/${logo}.svg`" :alt="logo" />
      </div>
    </div>

    <!-- Two rows on mobile -->
    <div
      data-testid="social-proof-mobile"
      class="flex flex-col gap-8 md:hidden"
    >
      <div class="animate-marquee flex items-center gap-8">
        <div
          v-for="(logo, i) in mobileRow1"
          :key="`${logo}-${i}`"
          class="flex h-14 w-40 shrink-0 items-center justify-center"
        >
          <img :src="`/icons/clients/${logo}.svg`" :alt="logo" />
        </div>
      </div>
      <div class="animate-marquee-reverse flex items-center gap-8">
        <div
          v-for="(logo, i) in mobileRow2"
          :key="`${logo}-${i}`"
          class="flex h-14 w-40 shrink-0 items-center justify-center"
        >
          <img :src="`/icons/clients/${logo}.svg`" :alt="logo" />
        </div>
      </div>
    </div>
  </section>
</template>
