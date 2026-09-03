<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import { hubWorkflowPath } from '../../lib/hub/workflow-detail'
import type { HubTemplate } from '../../lib/hub/types'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import HubWorkflowCard from './HubWorkflowCard.vue'

// An island cannot take a function as a prop: Astro serialises them as JSON,
// so the href is resolved here from the name.
const {
  templates,
  allHref,
  locale = 'en'
} = defineProps<{
  templates: readonly HubTemplate[]
  allHref: string
  locale?: Locale
}>()
</script>

<template>
  <section data-testid="related-workflows">
    <div class="mb-6 flex items-end justify-between gap-4">
      <h2 class="text-3xl font-medium tracking-tight text-primary-comfy-canvas">
        {{ t('workshop.workflow.related', locale) }}
      </h2>
      <a
        :href="allHref"
        class="text-primary-comfy-yellow hover:text-primary-comfy-yellow/80 inline-flex shrink-0 items-center gap-1 text-sm font-bold tracking-wider uppercase transition-colors"
        data-testid="related-workflows-all"
      >
        {{ t('workshop.workflow.relatedAll', locale) }}
        <ChevronRight class="size-4" aria-hidden="true" />
      </a>
    </div>

    <ul
      class="-mx-1 flex snap-x scrollbar-thin gap-5 overflow-x-auto px-1 pb-2"
    >
      <li
        v-for="template in templates"
        :key="template.name"
        class="w-72 shrink-0 snap-start lg:w-[calc((100%-3.75rem)/4)]"
      >
        <HubWorkflowCard
          :template="template"
          :href="hubWorkflowPath(template.name)"
          :try-now-label="t('workshop.hub.tryNow', locale)"
        />
      </li>
    </ul>
  </section>
</template>
