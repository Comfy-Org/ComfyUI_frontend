<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import AddToCalendarButton from '../../components/blocks/AddToCalendarButton.vue'
import HeroLivestream01 from '../../components/blocks/HeroLivestream01.vue'
import LaunchesHeroLogo from './LaunchesHeroLogo.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import { postProduction, postProductionStreamHref } from '../../data/events'
import { t } from '../../i18n/translations'
import { livestream } from './livestream'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const EVENT_DURATION_MS = 60 * 60 * 1000

const calendarEvent = postProduction.dateTime
  ? {
      title: postProduction.name[locale],
      description: `${postProduction.description[locale]}\n\n${postProductionStreamHref[locale]}`,
      location: postProductionStreamHref[locale],
      start: new Date(postProduction.dateTime),
      end: new Date(
        new Date(postProduction.dateTime).getTime() + EVENT_DURATION_MS
      )
    }
  : undefined
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
    <template #actions>
      <AddToCalendarButton
        v-if="calendarEvent"
        :event="calendarEvent"
        :labels="{
          trigger: t('launches.hero.addToCalendar', locale),
          google: t('launches.hero.calendarGoogle', locale),
          apple: t('launches.hero.calendarApple', locale),
          outlook: t('launches.hero.calendarOutlook', locale)
        }"
      />
    </template>
  </HeroLivestream01>
</template>
