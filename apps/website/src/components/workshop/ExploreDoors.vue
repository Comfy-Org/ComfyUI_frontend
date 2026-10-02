<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

type Section = 'apps' | 'workflows' | 'models'

const {
  apps,
  workflows,
  covers = {},
  locale = 'en'
} = defineProps<{
  apps: boolean
  workflows: boolean
  covers?: Partial<Record<Section, string>>
  locale?: Locale
}>()

const routes = getRoutes(locale)

interface Door {
  readonly section: Section
  readonly id: string
  readonly href: string
  readonly title: TranslationKey
  readonly hint: TranslationKey
}

const appsDoor: Door = {
  section: 'apps',
  id: 'explore-door-apps',
  href: routes.hubApps,
  title: 'workshop.explore.doorApps',
  hint: 'workshop.explore.appsHint'
}
const workflowsDoor: Door = {
  section: 'workflows',
  id: 'explore-door-workflows',
  href: routes.hubWorkflows,
  title: 'workshop.explore.doorWorkflows',
  hint: 'workshop.explore.workflowsHint'
}
const modelsDoor: Door = {
  section: 'models',
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
          class="group relative flex h-44 overflow-hidden rounded-3xl bg-hub-surface outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 lg:h-56"
          :data-testid="door.id"
        >
          <img
            v-if="covers[door.section]"
            :src="covers[door.section]"
            alt=""
            class="absolute inset-0 size-full object-cover transition-transform duration-500 select-none group-hover:scale-105"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
          <span
            class="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/5"
            aria-hidden="true"
          />
          <span
            class="absolute top-5 right-5 grid size-10 place-items-center rounded-full bg-primary-comfy-yellow text-primary-comfy-ink transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <ArrowRight class="size-5" />
          </span>
          <span class="relative mt-auto flex flex-col gap-1 p-6">
            <span
              class="text-2xl font-medium text-primary-warm-white lg:text-3xl"
            >
              {{ t(door.title, locale) }}
            </span>
            <span class="text-sm text-primary-warm-white/80">
              {{ t(door.hint, locale) }}
            </span>
          </span>
        </a>
      </li>
    </ul>
  </nav>
</template>
