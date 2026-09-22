<script setup lang="ts">
import { ArrowUpRight, BookOpen, Cloud, Download } from '@lucide/vue'
import type { Component } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  cloudUrl,
  downloadUrl,
  tutorialUrl,
  locale = 'en'
} = defineProps<{
  /** Comfy Cloud, opened on this template. */
  cloudUrl: string
  downloadUrl: string
  tutorialUrl: string | undefined
  locale?: Locale
}>()

interface Route {
  readonly id: string
  readonly href: string
  readonly icon: Component
  readonly label: TranslationKey
  readonly note: TranslationKey
  readonly download?: boolean
  readonly external?: boolean
}

// The ways to leave with this workflow, on the graph's own header because the
// graph is what they carry off. What each one gives you is on hover; spelled
// out, two rows of prose crowded the graph they belong to.
// None of them is the page's action: that is Run, and it is on the other tab.
// The endpoint is not among them: the API tab sits in the same row of tabs, so
// a row that only opened it would be a second door onto the same room.
const routes: readonly Route[] = [
  {
    id: 'workflow-open-cloud',
    href: cloudUrl,
    icon: Cloud,
    label: 'workshop.v2.workflow.openCloud',
    note: 'workshop.v2.workflow.openCloudNote',
    external: true
  },
  {
    id: 'workflow-download',
    href: downloadUrl,
    icon: Download,
    label: 'workshop.v2.workflow.download',
    note: 'workshop.v2.workflow.downloadNote',
    download: true
  },
  ...(tutorialUrl
    ? ([
        {
          id: 'workflow-tutorial',
          href: tutorialUrl,
          icon: BookOpen,
          label: 'workshop.v2.workflow.tutorial',
          note: 'workshop.v2.workflow.tutorialNote',
          external: true
        }
      ] as const)
    : [])
]
</script>

<template>
  <ul class="flex flex-wrap items-center gap-2" data-testid="workflow-actions">
    <li v-for="route in routes" :key="route.id">
      <a
        :href="route.href"
        :download="route.download ? '' : undefined"
        :target="route.external ? '_blank' : undefined"
        :rel="route.external ? 'noopener' : undefined"
        :data-testid="route.id"
        :title="t(route.note, locale)"
        class="group inline-flex h-9 items-center gap-2 rounded-xl border border-transparency-white-t20 bg-transparency-white-t4 ps-3 pe-2.5 text-xs font-bold tracking-wider text-primary-warm-white uppercase transition-colors outline-none hover:border-primary-comfy-yellow hover:bg-transparency-white-t8 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      >
        <component
          :is="route.icon"
          class="size-4 shrink-0 text-primary-comfy-yellow"
          aria-hidden="true"
        />
        {{ t(route.label, locale) }}
        <ArrowUpRight
          class="size-3.5 shrink-0 text-primary-warm-gray transition-colors group-hover:text-primary-comfy-yellow"
        />
      </a>
    </li>
  </ul>
</template>
