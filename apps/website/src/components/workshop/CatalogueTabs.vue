<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CatalogueTab } from '../../lib/workshop/catalogue-tabs'

const {
  locale = 'en',
  tabs = ['models', 'workflows', 'apps'],
  hrefs
} = defineProps<{
  locale?: Locale
  /** The home page teaches the same control with the halves it can open. */
  tabs?: readonly CatalogueTab[]
  hrefs?: Readonly<Record<CatalogueTab, string>>
}>()
const active = defineModel<CatalogueTab>({ required: true })
const labels = {
  models: 'workshop.hub.kind.models',
  workflows: 'workshop.hub.workflows',
  apps: 'workshop.catalogue.apps'
} as const
const marker = computed(
  () => `translateX(${tabs.indexOf(active.value) * 100}%)`
)
const columns = computed(() =>
  tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
)

function select(tab: CatalogueTab) {
  if (!hrefs) active.value = tab
}
</script>

<template>
  <div
    :class="
      cn(
        'relative grid w-fit shrink-0 rounded-2xl bg-transparency-white-t8 p-1 max-sm:w-full',
        columns
      )
    "
    role="group"
    :aria-label="t('workshop.catalogue.show', locale)"
    data-testid="catalogue-tabs"
  >
    <div :class="cn('pointer-events-none absolute inset-1 grid', columns)">
      <div
        class="rounded-xl bg-primary-comfy-canvas transition-transform duration-300 ease-out motion-reduce:transition-none"
        :style="{ transform: marker }"
      />
    </div>
    <component
      :is="hrefs ? 'a' : 'button'"
      v-for="tab in tabs"
      :key="tab"
      :href="hrefs?.[tab]"
      :type="hrefs ? undefined : 'button'"
      :aria-current="hrefs && active === tab ? 'page' : undefined"
      :aria-pressed="hrefs ? undefined : active === tab"
      :data-testid="`catalogue-tab-${tab}`"
      :class="
        cn(
          'relative inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-out outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 motion-reduce:transition-none max-sm:px-3',
          active === tab
            ? 'text-page'
            : 'text-content-secondary hover:text-content-bright'
        )
      "
      @click="select(tab)"
    >
      {{ t(labels[tab], locale) }}
    </component>
  </div>
</template>
