<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import { getRoutes } from '../../config/routes'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

type TabId = 'models' | 'workflows'

const { active, locale = 'en' } = defineProps<{
  active: TabId
  locale?: Locale
}>()

const { scope } = usePrototypeTweaks()
const routes = getRoutes(locale)

// Only V2 has a second tab, so V1 shows no tab bar at all.
const tabs: readonly { id: TabId; label: TranslationKey; href: string }[] = [
  { id: 'models', label: 'workshop.tabs.models', href: routes.workshop },
  {
    id: 'workflows',
    label: 'workshop.tabs.workflows',
    href: routes.workshopWorkflows
  }
]

const tabClass = (current: boolean) =>
  cn(
    'inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-bold tracking-wider uppercase transition-colors',
    current
      ? 'border-primary-comfy-yellow text-primary-warm-white'
      : 'border-transparent text-primary-warm-gray hover:text-primary-warm-white'
  )
</script>

<template>
  <nav
    v-if="scope === 'v2'"
    :aria-label="t('workshop.title', locale)"
    class="mb-10 border-b border-transparency-white-t8"
    data-testid="workshop-tabs"
    :data-scope="scope"
  >
    <ul class="flex gap-8">
      <li v-for="tab in tabs" :key="tab.id">
        <a
          :href="tab.href"
          :aria-current="tab.id === active ? 'page' : undefined"
          :class="tabClass(tab.id === active)"
          :data-testid="`workshop-tab-${tab.id}`"
        >
          {{ t(tab.label, locale) }}
        </a>
      </li>
    </ul>
  </nav>
</template>
