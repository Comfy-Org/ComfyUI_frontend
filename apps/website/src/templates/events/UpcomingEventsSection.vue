<script setup lang="ts">
import { ArrowRight, Calendar, MapPin } from '@lucide/vue'
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'

import AddToCalendarButton from '../../components/blocks/AddToCalendarButton.vue'
import Button from '../../components/ui/button/Button.vue'
import { localizeHref } from '../../config/routes'
import {
  eventPath,
  eventVideoId,
  toCalendarEvent,
  upcomingEvents
} from '../../data/events'
import { t } from '../../i18n/translations'
import { resolveRel } from '../../utils/cta'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Events with a stream open their own /events/[slug] page (dialog over the
// directory); the rest link out to the event's page.
const events = computed(() =>
  upcomingEvents.map((event) => ({
    ...event,
    calendarEvent: toCalendarEvent(event, locale),
    learnMore: eventVideoId(event)
      ? { href: localizeHref(eventPath(event), locale) }
      : event.link && {
          href: event.link.href[locale],
          newTab: event.link.newTab
        }
  }))
)
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <div
      class="rounded-5xl bg-transparency-white-t4 px-6 py-16 lg:px-14 lg:py-28"
    >
      <div class="flex flex-col gap-12 lg:flex-row lg:gap-24">
        <div class="max-w-sm shrink-0 lg:w-80">
          <h2
            class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl"
          >
            {{ t('events.upcoming.title', locale) }}
          </h2>
        </div>

        <ul class="flex min-w-0 grow flex-col">
          <li
            v-for="event in events"
            :key="event.id"
            class="flex flex-col gap-4 border-b border-primary-comfy-canvas/20 py-6 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
          >
            <div class="min-w-0">
              <h3
                class="text-primary-warm-white text-lg font-medium md:text-xl"
              >
                {{ event.title[locale] }}
              </h3>
              <p
                class="mt-2 text-sm font-light text-primary-comfy-canvas/60 md:text-base"
              >
                {{ event.description[locale] }}
              </p>
              <div
                class="mt-2 flex flex-col gap-2 text-sm font-light text-primary-comfy-canvas/60"
              >
                <span v-if="event.location" class="flex items-center gap-2">
                  <MapPin class="size-4 shrink-0" aria-hidden="true" />
                  {{ event.location[locale] }}
                </span>
                <span v-if="event.dateLabel" class="flex items-center gap-2">
                  <Calendar class="size-4 shrink-0" aria-hidden="true" />
                  {{ event.dateLabel[locale] }}
                </span>
              </div>
              <div v-if="event.calendarEvent" class="mt-4">
                <AddToCalendarButton
                  size="sm"
                  :event="event.calendarEvent"
                  :labels="{
                    trigger: t('events.upcoming.addToCalendar', locale),
                    google: t('events.upcoming.calendarGoogle', locale),
                    apple: t('events.upcoming.calendarApple', locale),
                    outlook: t('events.upcoming.calendarOutlook', locale)
                  }"
                />
              </div>
            </div>

            <Button
              v-if="event.learnMore"
              as="a"
              variant="link"
              :href="event.learnMore.href"
              :target="event.learnMore.newTab ? '_blank' : undefined"
              :rel="
                resolveRel({
                  target: event.learnMore.newTab ? '_blank' : undefined
                })
              "
              :append-icon="ArrowRight"
              :aria-label="`${event.title[locale]} — ${t('events.upcoming.livestream', locale)}`"
              class="shrink-0 normal-case"
            >
              {{ t('events.upcoming.livestream', locale) }}
            </Button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
