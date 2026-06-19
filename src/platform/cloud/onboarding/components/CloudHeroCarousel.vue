<template>
  <div
    class="relative flex size-full flex-col items-center overflow-hidden rounded-lg bg-primary-comfy-canvas/4 pt-10 pb-4"
  >
    <div
      class="flex w-full flex-1 flex-col items-center justify-center gap-6 md:gap-8 lg:gap-10"
    >
      <div
        class="relative aspect-5/4 w-full max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg"
      >
        <div class="absolute inset-0">
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

            <div
              class="absolute -top-1/20 -right-1/50 flex aspect-square w-7 items-center justify-center rounded-lg border border-primary-comfy-canvas/30 bg-white/20 text-primary-comfy-canvas shadow-xl backdrop-blur-sm"
            >
              <i class="icon-[comfy--gemini-mono] size-3.5" />
            </div>

            <div
              class="absolute -bottom-2/25 left-1/2 flex aspect-square w-10 -translate-x-1/2 items-center justify-center rounded-xl border border-primary-comfy-canvas/30 bg-white/20 text-primary-comfy-canvas shadow-xl backdrop-blur-sm"
            >
              <i class="icon-[comfy--grok] size-6" />
            </div>
          </div>

          <div class="absolute top-3/20 left-1/20 aspect-5/3 w-7/20">
            <div
              class="absolute inset-0 overflow-hidden rounded-2xl border border-primary-comfy-canvas/50 bg-cover bg-center bg-no-repeat shadow-2xl"
              :style="{ backgroundImage: `url(${topLeft})` }"
            />

            <div
              class="absolute -top-1/10 right-1/10 flex aspect-square w-7 items-center justify-center rounded-lg border border-primary-comfy-canvas/30 bg-white/20 text-primary-comfy-canvas shadow-xl backdrop-blur-sm"
            >
              <i class="icon-[comfy--bytedance-mono] size-3.5" />
            </div>
          </div>

          <div
            class="absolute bottom-3/20 left-1/10 aspect-4/3 w-1/4 overflow-hidden rounded-lg bg-cover bg-center bg-no-repeat shadow-2xl"
            :style="{ backgroundImage: `url(${bottomLeft})` }"
          />

          <div
            class="absolute right-2/25 bottom-1/10 aspect-4/3 w-3/10 overflow-hidden rounded-lg border border-primary-comfy-canvas/50 bg-cover bg-center bg-no-repeat shadow-2xl"
            :style="{ backgroundImage: `url(${bottomRight})` }"
          />
        </div>
      </div>

      <div
        class="relative flex w-full max-w-md flex-col items-center gap-1 text-center"
      >
        <p
          class="m-0 font-inter text-base font-semibold text-primary-comfy-canvas"
        >
          {{ t('cloudHero.slides.cloud.title') }}
        </p>
        <p class="m-0 font-inter text-sm text-primary-comfy-canvas/70">
          {{ t('cloudHero.slides.cloud.description') }}
        </p>
      </div>
    </div>

    <div
      v-if="isCloud"
      class="flex w-full items-center justify-center gap-3 pt-6"
    >
      <p class="m-0 hidden text-sm text-primary-comfy-canvas/90 md:block">
        {{ t('cloudStart_wantToRun') }}
      </p>
      <a
        href="https://www.comfy.org/download"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-8 items-center gap-2 rounded-lg border border-primary-comfy-canvas/20 bg-charcoal-500 p-2 text-xs font-medium text-primary-comfy-canvas no-underline hover:bg-charcoal-500/80"
      >
        <i class="pi pi-download text-xs text-primary-comfy-canvas/90" />
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

const { t } = useI18n()
</script>
