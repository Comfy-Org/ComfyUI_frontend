<script setup lang="ts">
import { ArrowRight, Calendar, MapPin } from '@lucide/vue'

import type { Locale } from '../../i18n/translations'

import Button from '../../components/ui/button/Button.vue'
import { upcomingEvents } from '../../data/events'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
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
            v-for="event in upcomingEvents"
            :key="event.id"
            class="flex flex-col gap-4 border-b border-primary-comfy-canvas/20 py-6 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
          >
            <div class="min-w-0">
              <h3
                class="text-primary-warm-white text-lg font-medium md:text-xl"
              >
                {{ event.name[locale] }}
              </h3>
              <p
                class="mt-2 text-sm font-light text-primary-comfy-canvas/60 md:text-base"
              >
                {{ event.description[locale] }}
              </p>
              <div
                class="mt-2 flex flex-col gap-2 text-sm font-light text-primary-comfy-canvas/60"
              >
                <span class="flex items-center gap-2">
                  <MapPin class="size-4 shrink-0" aria-hidden="true" />
                  {{ event.location[locale] }}
                </span>
                <span class="flex items-center gap-2">
                  <Calendar class="size-4 shrink-0" aria-hidden="true" />
                  {{ event.dateLabel[locale] }}
                </span>
              </div>
            </div>

            <Button
              as="a"
              variant="link"
              :href="event.link.href[locale]"
              target="_blank"
              rel="noopener noreferrer"
              :append-icon="ArrowRight"
              :aria-label="`${event.name[locale]} — ${t('events.upcoming.learnMore', locale)}`"
              class="shrink-0 normal-case"
            >
              {{ t('events.upcoming.learnMore', locale) }}
            </Button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
