<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { translationsFor } from '@/i18n/translations'
import type { Locale, TranslationKey } from '@/i18n/translations'
import type { CatalogueTab } from './CatalogueTabs.vue'
const { displayedSection, locale } = defineProps<{
  displayedSection: CatalogueTab
  locale: Locale
}>()
const { t } = translationsFor(locale)
const SUBTITLE_KEY = {
  models: 'workshop.hero.subtitle',
  workflows: 'workshop.catalogue.workflowsSubtitle',
  apps: 'workshop.catalogue.appsSubtitle'
} as const satisfies Record<CatalogueTab, TranslationKey>
</script>
<template>
  <div
    class="relative isolate -mx-6 mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 overflow-hidden px-6 pb-2 max-sm:mb-4 max-sm:pb-0 lg:-mx-8 lg:px-8 sm:short:pb-0"
    data-testid="workshop-hero"
  >
    <div class="grid text-lg text-primary-comfy-canvas/70">
      <p
        v-for="(subtitle, tab) in SUBTITLE_KEY"
        :key="tab"
        :class="
          cn(
            'col-start-1 row-start-1',
            tab === displayedSection ? 'animate-soft-in' : 'invisible'
          )
        "
        :aria-hidden="tab !== displayedSection"
      >
        {{ t(subtitle) }}
      </p>
    </div>
  </div>
</template>
