<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { localizeHref } from '../../config/routes'
import { fdctPage } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <HeroSplit01
    :locale
    :badge-text="t('fdct.hero.eyebrow', locale)"
    :title="t('fdct.hero.title', locale)"
    :subtitle="t('fdct.hero.subtitle', locale)"
    :primary-cta="{
      label: t('fdct.hero.contactCta', locale),
      href: localizeHref(fdctPage.ctas.contact, locale)
    }"
    video-minimal
    video-play-button-variant="overlay"
    :video-aria-label="t('fdct.hero.title', locale)"
    video-src="https://media.comfy.org/website/fdct/FDCT_V4.mp4"
    video-poster="https://media.comfy.org/website/fdct/FDCT_V4_thumb.jpeg"
  />
</template>
