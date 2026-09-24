<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useTablist } from '../../composables/useTablist'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { ModelSection } from './model-section'

const {
  sections,
  docsHref,
  locale = 'en'
} = defineProps<{
  sections: readonly ModelSection[]
  docsHref?: string
  locale?: Locale
}>()

const active = defineModel<ModelSection>({ required: true })

const sectionLabel: Record<ModelSection, TranslationKey> = {
  playground: 'workshop.model.tabs.playground',
  details: 'workshop.model.tabs.details',
  api: 'workshop.model.tabs.api'
}

const { onKeydown } = useTablist(() => sections, active)
</script>

<template>
  <div
    class="flex items-center gap-8 border-b border-transparency-white-t8 max-sm:gap-5"
  >
    <div
      role="tablist"
      :aria-label="t('workshop.title', locale)"
      class="scrollbar-hide flex min-w-0 gap-8 overflow-x-auto max-sm:gap-5"
      data-testid="model-tabs"
      @keydown="onKeydown"
    >
      <button
        v-for="section in sections"
        :id="`tab-${section}`"
        :key="section"
        type="button"
        role="tab"
        :aria-selected="section === active"
        :aria-controls="`panel-${section}`"
        :tabindex="section === active ? 0 : -1"
        :data-testid="`tab-${section}`"
        :class="
          cn(
            'cursor-pointer border-b-2 pb-3 text-sm font-bold tracking-wider uppercase transition-colors',
            section === active
              ? 'border-primary-comfy-yellow text-primary-warm-white'
              : 'border-transparent text-primary-warm-gray hover:text-primary-warm-white'
          )
        "
        @click="active = section"
      >
        {{ t(sectionLabel[section], locale) }}
      </button>
    </div>
    <a
      v-if="docsHref"
      :href="docsHref"
      target="_blank"
      rel="noopener noreferrer"
      class="ml-auto inline-flex shrink-0 items-center gap-1.5 pb-3 text-sm leading-none font-bold tracking-wider whitespace-nowrap text-primary-warm-white uppercase transition-colors hover:text-primary-comfy-yellow"
      data-testid="model-docs-link"
    >
      {{ t('workshop.hub.docs', locale) }}
      <ExternalLink class="size-4" aria-hidden="true" />
    </a>
  </div>
</template>
