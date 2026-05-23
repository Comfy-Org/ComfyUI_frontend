<template>
  <div
    class="relative flex size-full flex-col items-center overflow-hidden rounded-lg bg-sand-500/4 pt-10 pb-4"
    @mouseenter="pause"
    @mouseleave="resume"
    @focusin="pause"
    @focusout="resume"
  >
    <div
      class="flex w-full flex-1 flex-col items-center justify-center gap-6 md:gap-8 lg:gap-10"
    >
      <div
        class="relative aspect-5/4 w-full max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg"
      >
        <!--
          Chip and card positions use absolute % offsets per design spec.
          Tailwind fractions don't match these exact values, so [N%] is intentional here.
        -->
        <div
          v-for="(slide, index) in slides"
          v-show="index === currentIndex"
          :key="slide.id"
          class="absolute inset-0"
          :aria-hidden="index !== currentIndex"
        >
          <!-- Center card (anchors Gemini + Grok chips) -->
          <div
            class="absolute top-1/2 left-1/2 aspect-3/2 w-3/4 -translate-1/2"
          >
            <div
              class="absolute inset-0 rounded-3xl border border-white/20 bg-white/10 p-3.5 shadow-2xl"
            >
              <div
                class="size-full overflow-hidden rounded-xl bg-cover bg-center bg-no-repeat"
                :style="{ backgroundImage: `url(${centerImage})` }"
              />
            </div>

            <!-- Gemini chip -->
            <div
              class="absolute top-[-5%] right-[-2%] flex aspect-square w-7 items-center justify-center rounded-lg border border-sand-500/30 bg-white/20 text-sand-500 shadow-xl backdrop-blur-sm"
            >
              <GeminiLogo class="size-3.5" />
            </div>

            <!-- Grok chip -->
            <div
              class="absolute bottom-[-8%] left-1/2 flex aspect-square w-10 -translate-x-1/2 items-center justify-center rounded-xl border border-sand-500/30 bg-white/20 text-sand-500 shadow-xl backdrop-blur-sm"
            >
              <GrokLogo class="size-6" />
            </div>
          </div>

          <!-- Top-left card (anchors Seedance chip) -->
          <div class="absolute top-[15%] left-[5%] aspect-5/3 w-[35%]">
            <div
              class="absolute inset-0 overflow-hidden rounded-2xl border border-sand-500/50 bg-cover bg-center bg-no-repeat shadow-2xl"
              :style="{ backgroundImage: `url(${topLeft})` }"
            />

            <!-- Seedance chip -->
            <div
              class="absolute top-[-10%] right-[10%] flex aspect-square w-7 items-center justify-center rounded-lg border border-sand-500/30 bg-white/20 text-sand-500 shadow-xl backdrop-blur-sm"
            >
              <SeedanceLogo class="size-3.5" />
            </div>
          </div>

          <!-- Bottom-left card -->
          <div
            class="absolute bottom-[15%] left-[10%] aspect-4/3 w-1/4 overflow-hidden rounded-lg bg-cover bg-center bg-no-repeat shadow-2xl"
            :style="{ backgroundImage: `url(${bottomLeft})` }"
          />

          <!-- Bottom-right card -->
          <div
            class="absolute right-[8%] bottom-[10%] aspect-4/3 w-[30%] overflow-hidden rounded-lg border border-sand-500/50 bg-cover bg-center bg-no-repeat shadow-2xl"
            :style="{ backgroundImage: `url(${bottomRight})` }"
          />
        </div>
      </div>

      <!-- Caption -->
      <div
        class="relative flex w-full max-w-md flex-col items-center gap-1 text-center"
      >
        <p class="m-0 font-inter text-base font-semibold text-sand-500">
          {{ t(`cloudHero.slides.${currentSlide.id}.title`) }}
        </p>
        <p class="m-0 font-inter text-sm text-sand-500/70">
          {{ t(`cloudHero.slides.${currentSlide.id}.description`) }}
        </p>
      </div>

      <!-- Pager -->
      <div class="relative flex items-center gap-12">
        <Button
          variant="secondary"
          size="icon"
          class="rounded-lg border border-charcoal-400 bg-charcoal-400 text-sand-500 hover:bg-charcoal-500"
          :aria-label="t('cloudHero.previousSlide')"
          @click="goPrev"
        >
          <i class="pi pi-chevron-left" />
        </Button>

        <div class="flex items-center gap-2">
          <button
            v-for="(slide, index) in slides"
            :key="slide.id"
            type="button"
            class="size-2 shrink-0 cursor-pointer rounded-full border-none p-0 transition-colors"
            :class="index === currentIndex ? 'bg-sand-500' : 'bg-sand-500/30'"
            :aria-label="t('cloudHero.slidePagerLabel', { index: index + 1 })"
            :aria-current="index === currentIndex ? 'true' : undefined"
            @click="goTo(index)"
          />
        </div>

        <Button
          variant="secondary"
          size="icon"
          class="rounded-lg border border-charcoal-400 bg-charcoal-400 text-sand-500 hover:bg-charcoal-500"
          :aria-label="t('cloudHero.nextSlide')"
          @click="goNext"
        >
          <i class="pi pi-chevron-right" />
        </Button>
      </div>
    </div>

    <!-- Download CTA -->
    <div class="flex w-full items-center justify-center gap-3 pt-6">
      <p class="m-0 hidden text-sm text-sand-500/90 md:block">
        {{ t('cloudStart_wantToRun') }}
      </p>
      <Button
        type="button"
        variant="secondary"
        class="rounded-lg border border-sand-500/20 bg-charcoal-500 font-medium text-sand-500 hover:bg-charcoal-500/80"
        @click="handleDownloadClick"
      >
        <i class="pi pi-download text-xs text-sand-500/90" />
        {{ t('cloudStart_download') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import bottomLeft from '@/platform/cloud/onboarding/assets/hero/bottom-left.jpg'
import bottomRight from '@/platform/cloud/onboarding/assets/hero/bottom-right.jpg'
import centerImage from '@/platform/cloud/onboarding/assets/hero/center-image.jpg'
import topLeft from '@/platform/cloud/onboarding/assets/hero/top-left.jpg'
import GeminiLogo from '@/platform/cloud/onboarding/components/logos/GeminiLogo.vue'
import GrokLogo from '@/platform/cloud/onboarding/components/logos/GrokLogo.vue'
import SeedanceLogo from '@/platform/cloud/onboarding/components/logos/SeedanceLogo.vue'

type SlideId = 'cloud' | 'workflows' | 'team' | 'models'

type Slide = {
  id: SlideId
}

const slides: readonly Slide[] = [
  { id: 'cloud' },
  { id: 'workflows' },
  { id: 'team' },
  { id: 'models' }
] as const

const { t } = useI18n()
const currentIndex = ref(0)
const currentSlide = computed(() => slides[currentIndex.value])

const goTo = (index: number) => {
  currentIndex.value = (index + slides.length) % slides.length
}

const goNext = () => goTo(currentIndex.value + 1)
const goPrev = () => goTo(currentIndex.value - 1)

const { pause, resume } = useIntervalFn(goNext, 6000)

const handleDownloadClick = () => {
  window.open('https://www.comfy.org/download', '_blank')
}
</script>
