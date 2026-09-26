<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'

import { getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const href = `${getRoutes(locale).cinematicStudio}?ux=hub`
</script>

<template>
  <a
    :href
    class="-ml-1 inline-flex w-fit items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    data-testid="apps-back"
  >
    <ChevronLeft class="size-4" aria-hidden="true" />
    {{ tc('cinematic.backToApps', locale) }}
  </a>
</template>
