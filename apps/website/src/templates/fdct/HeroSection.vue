<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { localizeHref } from '../../config/routes'
import { fdctPage } from '../../data/fdct'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <HeroSplit01
    :locale
    :badge-text="t('fdct.hero.eyebrow').toLocaleUpperCase(locale)"
    :title="t('fdct.hero.title')"
    :subtitle="t('fdct.hero.subtitle')"
    :primary-cta="{
      label: t('fdct.hero.contactCta'),
      href: localizeHref(fdctPage.ctas.contact, locale)
    }"
    video-autoplay
    video-loop
    :video-aria-label="t('fdct.hero.title')"
    video-src="https://media.comfy.org/website/fdct/FDCT_V6.mp4"
    video-poster="https://media.comfy.org/website/fdct/FDCT_V4_thumb.jpeg"
  />
</template>
