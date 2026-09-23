<script setup lang="ts">
import { ArrowUpRight, BookOpen, Cloud, Download } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { Component } from 'vue'
import { computed } from 'vue'

import Button from '../ui/button/Button.vue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

type RouteKey = 'cloud' | 'download' | 'tutorial'

const {
  cloudUrl,
  downloadUrl,
  tutorialUrl,
  only,
  stacked = false,
  locale = 'en'
} = defineProps<{
  /** Comfy Cloud, opened on this template. */
  cloudUrl: string
  downloadUrl: string
  tutorialUrl: string | undefined
  /** Which ways out this row offers. All of them when left unsaid. */
  only?: readonly RouteKey[]
  /** One under the other, each the full width of the column it stands in. */
  stacked?: boolean
  locale?: Locale
}>()

interface Route {
  readonly key: RouteKey
  readonly id: string
  readonly href: string
  readonly icon: Component
  readonly label: TranslationKey
  readonly note: TranslationKey
  readonly download?: boolean
  readonly external?: boolean
}

// The ways to leave with this workflow. Comfy Cloud is the one that opens it
// somewhere it runs, so it leads and the rest follow it. What each one gives
// you is on hover; spelled out, the prose crowded the facts they stand under.
// None of them is the page's action: that is Run, and it is on the other tab.
// The endpoint is not among them: the API tab sits in the same row of tabs, so
// a row that only opened it would be a second door onto the same room.
const allRoutes: readonly Route[] = [
  {
    key: 'cloud',
    id: 'workflow-open-cloud',
    href: cloudUrl,
    icon: Cloud,
    label: 'workshop.v2.workflow.openCloud',
    note: 'workshop.v2.workflow.openCloudNote',
    external: true
  },
  {
    key: 'download',
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
          key: 'tutorial',
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

const routes = computed(() =>
  only ? allRoutes.filter((route) => only.includes(route.key)) : allRoutes
)
</script>

<template>
  <ul
    :class="
      cn(
        'flex gap-2',
        stacked ? 'flex-col items-stretch' : 'flex-wrap items-center'
      )
    "
    data-testid="workflow-actions"
  >
    <li v-for="route in routes" :key="route.id">
      <Button
        :variant="route.key === 'cloud' ? 'default' : 'outline'"
        :size="stacked ? 'lg' : 'sm'"
        :class="stacked && 'w-full'"
        :href="route.href"
        :prepend-icon="route.icon"
        :append-icon="ArrowUpRight"
        :download="route.download ? '' : undefined"
        :target="route.external ? '_blank' : undefined"
        :rel="route.external ? 'noopener' : undefined"
        :data-testid="route.id"
        :title="t(route.note, locale)"
      >
        {{ t(route.label, locale) }}
      </Button>
    </li>
  </ul>
</template>
