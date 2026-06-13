<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import Badge from '../common/Badge.vue'
import BrandButton from '../common/BrandButton.vue'
import VideoPlayer from '../common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const tags = ['Seadance 2.0', 'Image To Video']
const demoVideoSrc =
  'https://media.comfy.org/website/learning/skyreplacement_smaller_v06.mp4'
const demoVideoPoster =
  'https://media.comfy.org/website/learning/skyreplacement_smaller_v06_thumbnail.jpg'
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div class="flex flex-col gap-8">
        <div>
          <h2
            class="text-3xl leading-[110%] font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
          >
            {{ t('learning.featured.title', locale) }}
          </h2>
          <p class="text-primary-warm-gray mt-4 text-sm lg:text-base">
            {{ t('learning.featured.author', locale) }}
          </p>
        </div>

        <p
          class="max-w-md text-sm/relaxed text-primary-comfy-canvas lg:text-base"
        >
          {{ t('learning.featured.description', locale) }}
        </p>

        <div class="flex flex-wrap gap-3">
          <BrandButton
            variant="outline"
            size="xs"
            class="uppercase"
            href="https://comfy.org/workflows/537cf7f1f745-537cf7f1f745/"
          >
            {{ t('cta.tryWorkflow', locale) }}
          </BrandButton>
        </div>

        <ul class="mt-2 flex flex-wrap gap-3">
          <li v-for="tag in tags" :key="tag">
            <Badge variant="subtle">{{ tag }}</Badge>
          </li>
        </ul>
      </div>

      <div class="border-primary-warm-gray rounded-4.5xl border p-4">
        <VideoPlayer
          :locale
          :src="demoVideoSrc"
          :poster="demoVideoPoster"
          minimal
        />
      </div>
    </div>
  </section>
</template>
