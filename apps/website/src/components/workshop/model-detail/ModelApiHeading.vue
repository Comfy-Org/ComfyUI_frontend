<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { docsHref, locale = 'en' } = defineProps<{
  docsHref?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <div class="mb-8 flex items-baseline justify-between gap-4">
    <h2
      id="api-heading"
      class="text-sm font-bold tracking-wider text-primary-warm-white uppercase"
    >
      {{ t('workshop.model.tabs.api') }}
    </h2>
    <a
      v-if="docsHref"
      :href="docsHref"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex shrink-0 items-center gap-1.5 text-sm leading-none font-bold tracking-wider whitespace-nowrap text-primary-warm-white uppercase transition-colors hover:text-primary-comfy-yellow"
      data-testid="model-docs-link"
    >
      {{ t('workshop.hub.docs') }}
      <ExternalLink class="size-4" aria-hidden="true" />
    </a>
  </div>
</template>
