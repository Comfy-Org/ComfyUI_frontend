<script setup lang="ts">
import SocialProofLogo from './SocialProofLogo.vue'

const logos = [
  'Amazon Studios',
  'Apple',
  'Autodesk',
  'Harman',
  'Hp',
  'Lucid',
  'Netflix',
  'Nike',
  'Pixomondo',
  'Tencent',
  'Ubisoft'
].map((name) => ({ name, src: `/icons/clients/${name}.svg` }))

const agencyLogos = [
  { name: 'Asteria', src: '/icons/clients/Asteria.png' },
  { name: 'Black Math', src: '/icons/clients/Black Math.svg' },
  { name: 'Brick Visual', src: '/icons/clients/Brick Visual.png' },
  { name: 'Contender', src: '/icons/clients/Contender Dark.svg' },
  { name: 'Native Foreign', src: '/icons/clients/Native Foreign.png' },
  { name: 'Silverside', src: '/icons/clients/Silverside.svg' }
]

const agencyMaskStyles: Record<
  string,
  { maskSize: string; maskPosition: string; maskMode?: 'luminance' }
> = {
  'Brick Visual': {
    maskSize: '134.75px 109.82px',
    maskPosition: '11.95px -31.21px'
  },
  Contender: {
    maskSize: '188.08px 74.20px',
    maskPosition: '-14.11px -17.10px',
    maskMode: 'luminance'
  }
}

const allLogos = [...logos, ...agencyLogos]

const mobileSplit = Math.ceil(allLogos.length / 2)
const mobileRow1Logos = allLogos.slice(0, mobileSplit)
const mobileRow2Logos = allLogos.slice(mobileSplit)
const desktopDuration = `${(30 * allLogos.length) / logos.length}s`
const mobileRow1Duration = `${(30 * mobileRow1Logos.length) / Math.ceil(logos.length / 2)}s`
const mobileRow2Duration = `${(30 * mobileRow2Logos.length) / Math.floor(logos.length / 2)}s`
const mobileRows = [
  { logos: mobileRow1Logos, duration: mobileRow1Duration, reverse: false },
  { logos: mobileRow2Logos, duration: mobileRow2Duration, reverse: true }
]
</script>

<template>
  <section class="overflow-hidden py-8 md:py-12">
    <!-- Single row on desktop -->
    <div data-testid="social-proof-desktop" class="hidden w-max gap-2 md:flex">
      <div
        v-for="copy in 4"
        :key="copy"
        class="flex shrink-0 animate-marquee items-center gap-2"
        :style="{
          '--marquee-gap': '0.5rem',
          animationDuration: desktopDuration
        }"
        :aria-hidden="copy > 1 ? 'true' : undefined"
      >
        <div
          v-for="logo in allLogos"
          :key="logo.name"
          class="flex h-20 w-50 shrink-0 items-center justify-center"
        >
          <SocialProofLogo
            :name="logo.name"
            :src="logo.src"
            :masked="agencyLogos.includes(logo)"
            :mask-style="agencyMaskStyles[logo.name]"
          />
        </div>
      </div>
    </div>

    <!-- Two rows on mobile -->
    <div
      data-testid="social-proof-mobile"
      class="flex flex-col gap-6 md:hidden"
    >
      <div
        v-for="(row, index) in mobileRows"
        :key="index"
        class="flex w-max gap-8"
      >
        <div
          v-for="copy in 2"
          :key="copy"
          class="flex shrink-0 items-center gap-8"
          :class="row.reverse ? 'animate-marquee-reverse' : 'animate-marquee'"
          :style="{
            '--marquee-gap': '2rem',
            animationDuration: row.duration
          }"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <div
            v-for="logo in row.logos"
            :key="logo.name"
            class="flex h-10 w-40 shrink-0 items-center justify-center"
          >
            <SocialProofLogo
              :name="logo.name"
              :src="logo.src"
              :masked="agencyLogos.includes(logo)"
              :mask-style="agencyMaskStyles[logo.name]"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
