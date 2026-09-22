<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

import { WORKSHOP_API_HASH } from '../../config/workshop-api-anchor'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  cloudUrl,
  downloadUrl,
  runsHere,
  tutorialUrl,
  locale = 'en'
} = defineProps<{
  /** Comfy Cloud, opened on this template. */
  cloudUrl: string
  downloadUrl: string
  /** Whether the model runs on this page, which then has an endpoint to hand
    over. A workflow that needs local weights has nothing to hand over. */
  runsHere: boolean
  tutorialUrl: string | undefined
  locale?: Locale
}>()

interface Route {
  readonly id: string
  readonly href: string
  readonly label: TranslationKey
  readonly note: TranslationKey
  readonly download?: boolean
  readonly external?: boolean
}

// Three ways to leave with this workflow, each reading as what it gives you.
// None of them is the page's action: that is Run, and it is on the other tab.
const routes: readonly Route[] = [
  {
    id: 'workflow-open-cloud',
    href: cloudUrl,
    label: 'workshop.v2.workflow.openCloud',
    note: 'workshop.v2.workflow.openCloudNote',
    external: true
  },
  {
    id: 'workflow-download',
    href: downloadUrl,
    label: 'workshop.v2.workflow.download',
    note: 'workshop.v2.workflow.downloadNote',
    download: true
  },
  ...(runsHere
    ? ([
        {
          id: 'workflow-endpoint',
          href: WORKSHOP_API_HASH,
          label: 'workshop.v2.workflow.endpoint',
          note: 'workshop.v2.workflow.endpointNote'
        }
      ] as const)
    : []),
  ...(tutorialUrl
    ? ([
        {
          id: 'workflow-tutorial',
          href: tutorialUrl,
          label: 'workshop.v2.workflow.tutorial',
          note: 'workshop.v2.workflow.tutorialNote',
          external: true
        }
      ] as const)
    : [])
]
</script>

<template>
  <ul class="flex flex-col gap-2" data-testid="workflow-actions">
    <li v-for="route in routes" :key="route.id">
      <a
        :href="route.href"
        :download="route.download ? '' : undefined"
        :target="route.external ? '_blank' : undefined"
        :rel="route.external ? 'noopener' : undefined"
        :data-testid="route.id"
        class="group flex items-center gap-4 rounded-2xl border border-transparency-white-t8 px-5 py-4 transition-colors outline-none hover:border-transparency-white-t20 hover:bg-transparency-white-t4 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      >
        <span class="min-w-0 flex-1">
          <span
            class="block text-sm font-bold tracking-wider text-primary-warm-white uppercase"
          >
            {{ t(route.label, locale) }}
          </span>
          <span class="mt-1 block text-sm text-content-muted">
            {{ t(route.note, locale) }}
          </span>
        </span>
        <ChevronRight
          class="size-5 shrink-0 text-primary-warm-gray transition-colors group-hover:text-primary-comfy-yellow"
        />
      </a>
    </li>
  </ul>
</template>
