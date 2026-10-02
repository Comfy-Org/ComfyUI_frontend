<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchHighlight } from './types'

import BrandButton from '../../components/common/BrandButton.vue'
import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en', highlight } = defineProps<{
  highlight: ModelLaunchHighlight
  locale?: Locale
}>()

const routes = getRoutes(locale)
</script>

<template>
  <div
    class="flex flex-col gap-6 rounded-5xl bg-primary-comfy-yellow p-8 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-8"
  >
    <div class="min-w-0 flex-1">
      <h3 class="text-2xl font-medium text-primary-comfy-ink lg:text-3xl/tight">
        {{ t(highlight.titleKey, locale) }}
      </h3>
      <p class="mt-4 text-base/relaxed font-light text-primary-comfy-ink">
        {{ t(highlight.descriptionKey, locale) }}
      </p>
    </div>

    <BrandButton
      :href="routes[highlight.route ?? 'mcp']"
      variant="inverse"
      size="sm"
      class="h-12 shrink-0 px-5 uppercase"
    >
      {{ t(highlight.ctaKey, locale) }}
    </BrandButton>
  </div>
</template>
