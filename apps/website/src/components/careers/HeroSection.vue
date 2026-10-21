<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import { translationsFor } from '@/i18n/translations'
import GlassCard from '@/components/common/GlassCard.vue'
import SectionLabel from '@/components/common/SectionLabel.vue'
import VideoPlayer from '@/components/common/VideoPlayer.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="px-6 pt-20 pb-16 md:pt-28 md:pb-24">
    <div class="mx-auto max-w-4xl text-center">
      <SectionLabel>
        {{ t('careers.hero.label') }}
      </SectionLabel>
      <h1
        class="mt-4 text-4xl font-light whitespace-pre-line text-primary-comfy-canvas md:text-6xl"
      >
        {{ t('careers.hero.heading') }}
      </h1>
    </div>

    <GlassCard class="mx-auto mt-12 max-w-3xl md:mt-16">
      <VideoPlayer
        src="https://media.comfy.org/website/careers/recruiting-v03.mp4"
        poster="https://media.comfy.org/website/careers/recruiting-v03-poster.webp"
        :aria-label="t('careers.hero.videoLabel')"
        :locale
        autoplay
        loop
      />
      <div class="space-y-6 p-8 text-base/relaxed text-primary-comfy-canvas">
        <p>{{ t('careers.hero.body1') }}</p>
        <p>{{ t('careers.hero.body2') }}</p>
        <p>{{ t('careers.hero.body3') }}</p>
        <p>{{ t('careers.hero.body4') }}</p>
      </div>
    </GlassCard>
  </section>
</template>
