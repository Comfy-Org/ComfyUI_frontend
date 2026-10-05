<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import HeroLivestream01 from '@/components/blocks/HeroLivestream01.vue'
import LaunchesHeroLogo from './LaunchesHeroLogo.vue'
import { externalLinks, getRoutes } from '@/config/routes'
import { translationsFor } from '@/i18n/translations'
import { livestream } from './livestream'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)
</script>

<template>
  <HeroLivestream01
    :title="t('launches.hero.title')"
    :primary-cta="{
      label: t('launches.hero.primary'),
      href: routes.download
    }"
    :secondary-cta="{
      label: t('launches.hero.secondary'),
      href: externalLinks.cloud,
      target: '_blank'
    }"
    :youtube-video-id="livestream.youtubeVideoId"
    :start-date-time="livestream.startDateTime"
    :end-date-time="livestream.endDateTime"
  >
    <template #visual>
      <LaunchesHeroLogo :label="t('launches.hero.visualAlt')" />
    </template>
  </HeroLivestream01>
</template>
