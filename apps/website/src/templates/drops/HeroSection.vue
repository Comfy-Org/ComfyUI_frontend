<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import HeroLivestream01 from '../../components/blocks/HeroLivestream01.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import { livestream } from './livestream'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <HeroLivestream01
    :visual="{
      type: 'video',
      src: 'https://media.comfy.org/website/drops/Drops_hero_rotatinglogo.webm',
      alt: t('drops.hero.visualAlt', locale),
      width: 1760,
      height: 528
    }"
    :title="t('drops.hero.title', locale)"
    :primary-cta="{
      label: t('drops.hero.primary', locale),
      href: routes.download
    }"
    :secondary-cta="{
      label: t('drops.hero.secondary', locale),
      href: externalLinks.cloud,
      target: '_blank'
    }"
    :youtube-video-id="livestream.youtubeVideoId"
    :start-date-time="livestream.startDateTime"
    :end-date-time="livestream.endDateTime"
  />
</template>
