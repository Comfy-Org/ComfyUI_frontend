<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
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
    href: routes.hubExplore
  },
  {
    section: 'apps',
    id: 'create',
    label: 'workshop.space.create',
    href: routes.hubApps
  },
  {
    section: 'workflows',
    id: 'customize',
    label: 'workshop.space.customize',
    href: routes.hubWorkflows
  },
  {
    section: 'models',
    id: 'build',
    label: 'workshop.space.build',
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
const HINT = {
  explore: 'workshop.space.exploreHint',
  apps: 'workshop.space.createHint',
  workflows: 'workshop.space.customizeHint',
  models: 'workshop.space.buildHint'
} as const satisfies Record<HubSection, TranslationKey>
</script>

<template>
  <nav
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
    <span class="ml-auto text-sm text-content-secondary max-sm:hidden">
      {{ t(HINT[section], locale) }}
    </span>
  </nav>
</template>
