<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CardSplitContent01 from '../blocks/CardSplitContent01.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <CardSplitContent01
    :locale
    :eyebrow="t('modelRelease.eyebrow', locale)"
    :title="t('modelRelease.title', locale)"
    :body="t('modelRelease.body', locale)"
    :primary-cta="{ label: t('modelRelease.viewFeatures', locale), href: '#' }"
    :secondary-cta="{
      label: t('modelRelease.tryWorkflows', locale),
      href: '#'
    }"
    :tags="[t('tags.openWeights', locale), t('tags.partnerNodes', locale)]"
    video-src="https://media.comfy.org/website/minimax/hero.mp4"
    video-poster="https://media.comfy.org/website/minimax/hero-fallback.jpg"
  />
</template>
