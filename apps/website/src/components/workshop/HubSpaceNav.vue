<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAppsEnabled } from '../../scripts/posthog'
import type { CatalogueTab } from './CatalogueTabs.vue'

const { section, locale = 'en' } = defineProps<{
  section: CatalogueTab
  locale?: Locale
}>()

const appsEnabled = useWorkshopAppsEnabled()
const routes = getRoutes(locale)
const current = section === 'apps' ? 'create' : 'build'
const spaces = [
  { id: 'create', label: 'workshop.space.create', href: routes.hubApps },
  { id: 'build', label: 'workshop.space.build', href: routes.workshop }
] as const
</script>

<template>
  <nav
    v-if="appsEnabled"
    class="mb-8 flex gap-7 border-b border-transparency-white-t8 max-sm:mb-5"
    :aria-label="t('workshop.space.label', locale)"
    data-testid="hub-space-nav"
  >
    <a
      v-for="item in spaces"
      :key="item.id"
      :href="item.href"
      :aria-current="current === item.id ? 'page' : undefined"
      :data-testid="`hub-space-${item.id}`"
      :class="
        cn(
          '-mb-px inline-flex h-12 items-center border-b-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
          current === item.id
            ? 'border-primary-comfy-yellow text-content-bright'
            : 'border-transparent text-content-secondary hover:text-content-bright'
        )
      "
    >
      {{ t(item.label, locale) }}
    </a>
  </nav>
</template>
