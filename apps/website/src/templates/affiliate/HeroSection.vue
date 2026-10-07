<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import { translationsFor } from '@/i18n/translations'
import HeroSplit01 from '@/components/blocks/HeroSplit01.vue'
import { externalLinks } from '@/config/routes.ts'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <HeroSplit01
    :badge-text="t('affiliate.hero.label')"
    :title-highlight="t('affiliate.hero.headingHighlight')"
    :title="t('affiliate.hero.headingMuted')"
    :features="[
      t('affiliate.hero.feature1'),
      t('affiliate.hero.feature2'),
      t('affiliate.hero.feature3'),
      t('affiliate.hero.feature4')
    ]"
    :primary-cta="{
      label: t('affiliate.hero.apply'),
      href: externalLinks.affiliateApplicationForm
    }"
    video-autoplay
    video-loop
    video-hide-controls
    video-src="https://media.comfy.org/website/affiliates/rainlit-ronin_compressed.mp4"
    :image-alt="t('affiliate.hero.imageAlt')"
  />
</template>
