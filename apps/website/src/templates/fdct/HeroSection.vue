<script setup lang="ts">
import type { Locale } from '../../i18n/site'

import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { localizeHref } from '../../config/routes'
import { fdctPage } from '../../data/fdct'
import { t } from '../../i18n/site'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <HeroSplit01
    :locale
    :badge-text="
      t('fdct.hero.eyebrow', {}, { locale: locale }).toLocaleUpperCase(locale)
    "
    :title="t('fdct.hero.title', {}, { locale: locale })"
    :subtitle="t('fdct.hero.subtitle', {}, { locale: locale })"
    :primary-cta="{
      label: t('fdct.hero.contactCta', {}, { locale: locale }),
      href: localizeHref(fdctPage.ctas.contact, locale)
    }"
    video-autoplay
    video-loop
    :video-aria-label="t('fdct.hero.title', {}, { locale: locale })"
    video-src="https://media.comfy.org/website/fdct/FDCT_V6.mp4"
    video-poster="https://media.comfy.org/website/fdct/FDCT_V4_thumb.jpeg"
  />
</template>
