<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { ChevronLeft } from '@lucide/vue'

import HubBreadcrumb from '@/components/workshop/HubBreadcrumb.vue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'

const { current, locale = 'en' } = defineProps<{
  /** The app this page opens, named last in the breadcrumb. */
  current: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)
const href = routes.hubApps
const crumbs = [
  { label: t('workshop.catalogue.eyebrow'), href: routes.hubExplore },
  { label: t('workshop.catalogue.apps'), href },
  { label: current }
]
</script>

<template>
  <div class="flex items-center justify-between gap-6">
    <a
      :href
      class="-ml-1 inline-flex w-fit shrink-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="apps-back"
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
      {{ t('cinematic.backToApps') }}
    </a>
    <HubBreadcrumb :crumbs :locale class="max-sm:hidden" />
  </div>
</template>
