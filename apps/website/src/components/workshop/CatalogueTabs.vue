<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export type CatalogueTab = 'models' | 'workflows' | 'apps'

const {
  locale = 'en',
  tabs = ['models', 'workflows', 'apps'],
  links = false
} = defineProps<{
  locale?: Locale
  /** The home page teaches the same control with the halves it can open. */
  tabs?: readonly CatalogueTab[]
  links?: boolean
}>()
const active = defineModel<CatalogueTab>({ required: true })
const labels = {
  models: 'workshop.hub.kind.models',
  workflows: 'workshop.hub.workflows',
  apps: 'workshop.catalogue.apps'
} as const
const routes = getRoutes(locale)
const hrefs = {
  models: routes.workshop,
  workflows: routes.hubWorkflows,
  apps: routes.hubApps
} as const satisfies Record<CatalogueTab, string>
const marker = computed(
  () => `translateX(${tabs.indexOf(active.value) * 100}%)`
)
const columns = computed(() =>
  tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
)
const tabClass = (tab: CatalogueTab) =>
  cn(
    'relative inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-out outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 motion-reduce:transition-none max-sm:px-3',
    active.value === tab
      ? 'text-page'
      : 'text-content-secondary hover:text-content-bright'
  )
</script>

<template>
  <component
    :is="links ? 'nav' : 'div'"
    :class="
      cn(
        'relative grid w-fit shrink-0 rounded-2xl bg-transparency-white-t8 p-1 max-sm:w-full',
        columns
      )
    "
    :role="links ? undefined : 'group'"
    :aria-label="t('workshop.catalogue.show', locale)"
    data-testid="catalogue-tabs"
  >
    <div :class="cn('pointer-events-none absolute inset-1 grid', columns)">
      <div
        class="rounded-xl bg-primary-comfy-canvas transition-transform duration-300 ease-out motion-reduce:transition-none"
        :style="{ transform: marker }"
      />
    </div>
    <template v-for="tab in tabs" :key="tab">
      <a
        v-if="links"
        :href="hrefs[tab]"
        :aria-current="active === tab ? 'page' : undefined"
        :data-testid="`catalogue-tab-${tab}`"
        :class="tabClass(tab)"
      >
        {{ t(labels[tab], locale) }}
      </a>
      <button
        v-else
        type="button"
        :aria-pressed="active === tab"
        :data-testid="`catalogue-tab-${tab}`"
        :class="tabClass(tab)"
        @click="active = tab"
      >
        {{ t(labels[tab], locale) }}
      </button>
    </template>
  </component>
</template>
