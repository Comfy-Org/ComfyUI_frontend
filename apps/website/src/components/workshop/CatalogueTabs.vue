<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { captureHubFilterChange } from '@/scripts/hub-analytics'

export type CatalogueTab = 'models' | 'workflows' | 'apps'

const {
  locale = 'en',
  tabs = ['models', 'workflows', 'apps'],
  links = false,
  localeLinks = false
} = defineProps<{
  locale?: Locale
  /** The home page teaches the same control with the halves it can open. */
  tabs?: readonly CatalogueTab[]
  links?: boolean
  localeLinks?: boolean
}>()
const { t } = translationsFor(locale)
const tabsRoot = useTemplateRef<HTMLElement>('tabsRoot')
const mounted = ref(false)
let stopObserving = () => {}
onMounted(() => {
  const island = tabsRoot.value?.closest<HTMLElement>(
    'astro-island[data-astro-transition-persist^="ccc-hub-catalogue-"]'
  )
  if (!localeLinks || !island || !island.hasAttribute('ssr')) {
    mounted.value = true
    return
  }
  function ready() {
    if (!island || island.hasAttribute('ssr')) return
    mounted.value = true
    stopObserving()
  }
  function hydrated(event: Event) {
    if (event.target === island) ready()
  }
  const observer = new MutationObserver(ready)
  observer.observe(island, { attributes: true, attributeFilter: ['ssr'] })
  island.addEventListener('astro:hydrate', hydrated)
  stopObserving = () => {
    observer.disconnect()
    island.removeEventListener('astro:hydrate', hydrated)
  }
})
onBeforeUnmount(() => stopObserving())
const active = defineModel<CatalogueTab>({ required: true })
const emit = defineEmits<{ navigate: [CatalogueTab] }>()
function navigate(event: MouseEvent, tab: CatalogueTab) {
  const anchor = event.currentTarget
  if (
    (localeLinks && !mounted.value) ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(anchor instanceof HTMLAnchorElement) ||
    (anchor.target !== '' && anchor.target !== '_self') ||
    anchor.hasAttribute('download')
  )
    return
  emit('navigate', tab)
}
function openTab(event: MouseEvent, tab: CatalogueTab) {
  captureHubFilterChange(active.value, 'catalogue', tab, active.value)
  navigate(event, tab)
}
const labels = {
  models: 'workshop.hub.kind.models',
  workflows: 'workshop.hub.workflows',
  apps: 'workshop.catalogue.apps'
} as const
const routes = getRoutes(locale)
const hrefs = {
  models:
    localeLinks && locale === 'zh-CN'
      ? `/zh-CN${routes.workshop}`
      : routes.workshop,
  workflows:
    localeLinks && locale === 'zh-CN'
      ? `/zh-CN${routes.hubWorkflows}`
      : routes.hubWorkflows,
  apps:
    localeLinks && locale === 'zh-CN'
      ? `/zh-CN${routes.hubApps}`
      : routes.hubApps
} as const satisfies Record<CatalogueTab, string>
const markerStyle = computed(() => ({
  transform: `translateX(${tabs.indexOf(active.value) * 100}%)`,
  // Each hub section is its own page, so the marker cannot transition from
  // the tab it left: named, the browser carries it across the navigation.
  viewTransitionName: links ? 'catalogue-marker' : undefined
}))
const columns = computed(() =>
  tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
)
const tabClass = (tab: CatalogueTab) =>
  cn(
    'relative inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-out outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 motion-reduce:transition-none max-sm:px-3',
    active.value === tab
      ? 'text-primary-warm-white'
      : 'text-content-secondary hover:text-content-bright'
  )
</script>

<template>
  <component
    :is="links ? 'nav' : 'div'"
    ref="tabsRoot"
    :class="
      cn(
        'relative grid w-fit shrink-0 rounded-2xl bg-transparency-white-t8 p-1 max-sm:w-full',
        columns
      )
    "
    :role="links ? undefined : 'group'"
    :aria-label="t('workshop.catalogue.show')"
    data-testid="catalogue-tabs"
  >
    <div :class="cn('pointer-events-none absolute inset-1 grid', columns)">
      <div
        class="rounded-xl bg-transparency-white-t20 transition-transform duration-300 ease-out motion-reduce:transition-none"
        :style="markerStyle"
        data-testid="catalogue-marker"
      />
    </div>
    <template v-for="tab in tabs" :key="tab">
      <a
        v-if="links"
        :href="hrefs[tab]"
        :data-astro-reload="localeLinks && !mounted ? '' : undefined"
        :aria-current="active === tab ? 'page' : undefined"
        :data-testid="`catalogue-tab-${tab}`"
        :class="tabClass(tab)"
        @click="openTab($event, tab)"
      >
        {{ t(labels[tab]) }}
      </a>
      <button
        v-else
        type="button"
        :aria-pressed="active === tab"
        :data-testid="`catalogue-tab-${tab}`"
        :class="tabClass(tab)"
        @click="active = tab"
      >
        {{ t(labels[tab]) }}
      </button>
    </template>
  </component>
</template>
