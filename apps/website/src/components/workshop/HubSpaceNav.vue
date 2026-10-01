<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  useWorkshopAppsEnabled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import type { CatalogueTab } from './CatalogueTabs.vue'

export type HubSection = CatalogueTab | 'explore'

const { section, locale = 'en' } = defineProps<{
  section: HubSection
  locale?: Locale
}>()

const appsEnabled = useWorkshopAppsEnabled()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const routes = getRoutes(locale)

const SPACES = [
  {
    section: 'explore',
    id: 'explore',
    label: 'workshop.space.explore',
    hint: 'workshop.space.exploreHint',
    href: routes.hubExplore
  },
  {
    section: 'apps',
    id: 'create',
    label: 'workshop.space.create',
    hint: 'workshop.space.createHint',
    href: routes.hubApps
  },
  {
    section: 'workflows',
    id: 'customize',
    label: 'workshop.space.customize',
    hint: 'workshop.space.customizeHint',
    href: routes.hubWorkflows
  },
  {
    section: 'models',
    id: 'build',
    label: 'workshop.space.build',
    hint: 'workshop.space.buildHint',
    href: routes.workshop
  }
] as const

const spaces = computed(() =>
  SPACES.filter(
    (space) =>
      space.section === section ||
      space.section === 'explore' ||
      space.section === 'models' ||
      (space.section === 'apps' ? appsEnabled.value : workflowsEnabled.value)
  )
)
const current = computed(() =>
  SPACES.find((space) => space.section === section)
)
</script>

<template>
  <nav
    v-if="spaces.length > 1"
    class="mb-8 flex items-center gap-7 border-b border-transparency-white-t8 max-sm:mb-5"
    :aria-label="t('workshop.space.label', locale)"
    data-testid="hub-space-nav"
  >
    <a
      v-for="space in spaces"
      :key="space.id"
      :href="space.href"
      :aria-current="space.section === section ? 'page' : undefined"
      :data-testid="`hub-space-${space.id}`"
      :class="
        cn(
          'relative inline-flex h-12 items-center text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
          space.section === section
            ? 'text-content-bright'
            : 'text-content-secondary hover:text-content-bright'
        )
      "
    >
      {{ t(space.label, locale) }}
      <span
        v-if="space.section === section"
        class="absolute inset-x-0 -bottom-px h-0.5 bg-primary-comfy-yellow [view-transition-name:hub-space-marker]"
        data-testid="hub-space-marker"
      />
    </a>
    <span
      v-if="current"
      class="ml-auto text-sm text-content-secondary max-sm:hidden"
    >
      {{ t(current.hint, locale) }}
    </span>
  </nav>
</template>
