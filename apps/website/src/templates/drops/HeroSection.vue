<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import HeroLivestream01 from '../../components/blocks/HeroLivestream01.vue'
import LaunchesHeroLogo from './LaunchesHeroLogo.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import { livestream } from './livestream'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <HeroLivestream01
    :title="t('launches.hero.title', locale)"
    :primary-cta="{
      label: t('launches.hero.primary', locale),
      href: routes.download
    }"
    :secondary-cta="{
      label: t('launches.hero.secondary', locale),
      href: externalLinks.cloud,
      target: '_blank'
    }"
    :youtube-video-id="livestream.youtubeVideoId"
    :start-date-time="livestream.startDateTime"
    :end-date-time="livestream.endDateTime"
  >
    <template #visual>
      <LaunchesHeroLogo :label="t('launches.hero.visualAlt', locale)" />
    </template>
  </HeroLivestream01>
</template>
