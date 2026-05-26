<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const tags = ['Seadance 2.0', 'Image To Video']
const demoVideoSrc = 'https://media.comfy.org/videos/compressed_512/swings.webm'
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div class="flex flex-col gap-8">
        <div>
          <h2
            class="text-primary-comfy-canvas text-4xl font-light tracking-tight lg:text-6xl"
          >
            {{ t('learning.featured.title', locale) }}
          </h2>
          <p class="text-primary-warm-gray mt-4 text-sm lg:text-base">
            {{ t('learning.featured.author', locale) }}
          </p>
        </div>

        <p
          class="text-primary-comfy-canvas max-w-md text-sm/relaxed lg:text-base"
        >
          {{ t('learning.featured.description', locale) }}
        </p>

        <div class="flex flex-wrap gap-3">
          <BrandButton variant="solid" size="xs" class="uppercase">
            {{ t('learning.featured.watchDemo', locale) }}
          </BrandButton>
          <BrandButton variant="outline" size="xs" class="uppercase">
            {{ t('cta.tryWorkflow', locale) }}
          </BrandButton>
        </div>

        <div class="mt-2 flex flex-wrap gap-3">
          <span
            v-for="tag in tags"
            :key="tag"
            class="text-primary-warm-gray border-primary-warm-gray/40 rounded-full border px-4 py-1.5 text-xs"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <div class="border-primary-warm-gray rounded-4.5xl border p-4">
        <VideoPlayer :locale :src="demoVideoSrc" minimal />
      </div>
    </div>
  </section>
</template>
