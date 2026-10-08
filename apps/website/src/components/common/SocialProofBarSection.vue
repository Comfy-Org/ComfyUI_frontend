<script setup lang="ts">
const { agencyPartners = false } = defineProps<{ agencyPartners?: boolean }>()

const clientLogos = [
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
]

const logos = agencyPartners
  ? [...clientLogos, 'Native Foreign', 'Black Math']
  : clientLogos
const partnerLogoSources: Record<string, string> = {
  'Native Foreign': '/images/agency-partners/native-foreign-white.png',
  'Black Math': '/images/agency-partners/black-math-stacked.png'
}

const mobileRow1Logos = logos.slice(0, 6)
const mobileRow2Logos = logos.slice(6)
</script>

<template>
  <section class="overflow-hidden py-8 md:py-12">
    <!-- Single row on desktop -->
    <div data-testid="social-proof-desktop" class="hidden w-max gap-2 md:flex">
      <div
        v-for="copy in 2"
        :key="copy"
        class="flex shrink-0 animate-marquee items-center gap-2"
        style="--marquee-gap: 0.5rem"
        :aria-hidden="copy === 2 ? 'true' : undefined"
      >
        <div
          v-for="logo in logos"
          :key="logo"
          class="flex h-20 w-50 shrink-0 items-center justify-center"
        >
          <span
            v-if="partnerLogoSources[logo]"
            role="img"
            :aria-label="logo"
            class="h-20 w-40 bg-secondary-mauve mask-contain mask-center mask-no-repeat"
            :style="{
              maskImage: `url('${partnerLogoSources[logo]}')`,
              scale: logo === 'Native Foreign' ? '0.7' : undefined
            }"
          />
          <img v-else :src="`/icons/clients/${logo}.svg`" :alt="logo" />
        </div>
      </div>
    </div>

    <!-- Two rows on mobile -->
    <div
      data-testid="social-proof-mobile"
      class="flex flex-col gap-6 md:hidden"
    >
      <div class="flex w-max gap-8">
        <div
          v-for="copy in 2"
          :key="copy"
          class="flex shrink-0 animate-marquee items-center gap-8"
          style="--marquee-gap: 2rem"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <div
            v-for="logo in mobileRow1Logos"
            :key="logo"
            class="flex h-10 w-40 shrink-0 items-center justify-center"
          >
            <span
              v-if="partnerLogoSources[logo]"
              role="img"
              :aria-label="logo"
              class="h-10 w-32 bg-secondary-mauve mask-contain mask-center mask-no-repeat"
              :style="{
                maskImage: `url('${partnerLogoSources[logo]}')`,
                scale: logo === 'Native Foreign' ? '0.7' : undefined
              }"
            />
            <img v-else :src="`/icons/clients/${logo}.svg`" :alt="logo" />
          </div>
        </div>
      </div>
      <div v-if="mobileRow2Logos.length" class="flex w-max gap-8">
        <div
          v-for="copy in 2"
          :key="copy"
          class="flex shrink-0 animate-marquee-reverse items-center gap-8"
          style="--marquee-gap: 2rem"
          :aria-hidden="copy === 2 ? 'true' : undefined"
        >
          <div
            v-for="logo in mobileRow2Logos"
            :key="logo"
            class="flex h-10 w-40 shrink-0 items-center justify-center"
          >
            <span
              v-if="partnerLogoSources[logo]"
              role="img"
              :aria-label="logo"
              class="h-10 w-32 bg-secondary-mauve mask-contain mask-center mask-no-repeat"
              :style="{
                maskImage: `url('${partnerLogoSources[logo]}')`,
                scale: logo === 'Native Foreign' ? '0.7' : undefined
              }"
            />
            <img v-else :src="`/icons/clients/${logo}.svg`" :alt="logo" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
