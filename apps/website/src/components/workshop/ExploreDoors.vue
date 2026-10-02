<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  apps,
  workflows,
  locale = 'en'
} = defineProps<{
  apps: boolean
  workflows: boolean
  locale?: Locale
}>()

const routes = getRoutes(locale)

interface Door {
  readonly id: string
  readonly href: string
  readonly title: TranslationKey
  readonly hint: TranslationKey
}

const appsDoor: Door = {
  id: 'explore-door-apps',
  href: routes.hubApps,
  title: 'workshop.explore.doorApps',
  hint: 'workshop.explore.appsHint'
}
const workflowsDoor: Door = {
  id: 'explore-door-workflows',
  href: routes.hubWorkflows,
  title: 'workshop.explore.doorWorkflows',
  hint: 'workshop.explore.workflowsHint'
}
const modelsDoor: Door = {
  id: 'explore-door-models',
  href: routes.workshop,
  title: 'workshop.explore.modelsTitle',
  hint: 'workshop.explore.modelsHint'
}
const doors = computed(() => [
  ...(apps ? [appsDoor] : []),
  ...(workflows ? [workflowsDoor] : []),
  modelsDoor
])
</script>

<template>
  <nav
    :aria-label="t('workshop.explore.doors', locale)"
    data-testid="explore-doors"
  >
    <ul class="grid grid-cols-1 gap-5 md:grid-cols-3">
      <li v-for="door in doors" :key="door.id">
        <a
          :href="door.href"
          class="group flex h-full items-center justify-between gap-4 rounded-3xl border border-transparency-white-t8 p-6 transition-colors outline-none hover:bg-hub-surface focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
          :data-testid="door.id"
        >
          <span class="flex flex-col gap-1">
            <span class="text-lg font-medium text-primary-warm-white">
              {{ t(door.title, locale) }}
            </span>
            <span class="text-sm text-content-secondary">
              {{ t(door.hint, locale) }}
            </span>
          </span>
          <ChevronRight
            class="size-5 shrink-0 text-primary-warm-gray transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      </li>
    </ul>
  </nav>
</template>
