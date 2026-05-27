<template>
  <div
    class="relative flex size-full flex-col items-center overflow-hidden rounded-lg bg-sand-500/4 pt-10 pb-4"
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
        <div class="absolute inset-0">
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
          {{ t('cloudHero.slides.cloud.title') }}
        </p>
        <p class="m-0 font-inter text-sm text-sand-500/70">
          {{ t('cloudHero.slides.cloud.description') }}
        </p>
      </div>
    </div>

    <!-- Download CTA (cloud build only) -->
    <div
      v-if="isCloud"
      class="flex w-full items-center justify-center gap-3 pt-6"
    >
      <p class="m-0 hidden text-sm text-sand-500/90 md:block">
        {{ t('cloudStart_wantToRun') }}
      </p>
      <a
        href="https://www.comfy.org/download"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-8 items-center gap-2 rounded-lg border border-sand-500/20 bg-charcoal-500 p-2 text-xs font-medium text-sand-500 no-underline hover:bg-charcoal-500/80"
      >
        <i class="pi pi-download text-xs text-sand-500/90" />
        {{ t('cloudStart_download') }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import bottomLeft from '@/platform/cloud/onboarding/assets/hero/bottom-left.jpg'
import bottomRight from '@/platform/cloud/onboarding/assets/hero/bottom-right.jpg'
import centerImage from '@/platform/cloud/onboarding/assets/hero/center-image.jpg'
import topLeft from '@/platform/cloud/onboarding/assets/hero/top-left.jpg'
import { isCloud } from '@/platform/distribution/types'
import GeminiLogo from '@/platform/cloud/onboarding/components/logos/GeminiLogo.vue'
import GrokLogo from '@/platform/cloud/onboarding/components/logos/GrokLogo.vue'
import SeedanceLogo from '@/platform/cloud/onboarding/components/logos/SeedanceLogo.vue'

const { t } = useI18n()
</script>
