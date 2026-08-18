<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { externalLinks } from '@/config/routes.ts'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <HeroSplit01
    :badge-text="t('affiliate.hero.label', locale)"
    :title-highlight="t('affiliate.hero.headingHighlight', locale)"
    :title="t('affiliate.hero.headingMuted', locale)"
    :features="[
      t('affiliate.hero.feature1', locale),
      t('affiliate.hero.feature2', locale),
      t('affiliate.hero.feature3', locale),
      t('affiliate.hero.feature4', locale)
    ]"
    :primary-cta="{
      label: t('affiliate.hero.apply', locale),
      href: externalLinks.affiliateApplicationForm
    }"
    video-autoplay
    video-loop
    video-hide-controls
    video-src="https://media.comfy.org/website/affiliates/rainlit-ronin_compressed.mp4"
    :image-alt="t('affiliate.hero.imageAlt', locale)"
  />
</template>
