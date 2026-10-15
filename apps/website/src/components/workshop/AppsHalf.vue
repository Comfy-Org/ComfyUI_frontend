<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import {
  loadAppCatalogue,
  loadHubAppCatalogue
} from '@/lib/workshop/catalogue-components'
import { upcomingApps } from '@/lib/workshop/hub-coming-soon-apps'
import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import { useWorkshopFlag } from '@/scripts/posthog'

const { apps, locale = 'en' } = defineProps<{
  apps: readonly CatalogueApp[]
  locale?: Locale
}>()
const browseAll = defineModel<boolean>('browseAll')
const emit = defineEmits<{ section: [inSection: boolean] }>()

const AppCatalogue = defineAsyncComponent(loadAppCatalogue)
const HubAppCatalogue = defineAsyncComponent(loadHubAppCatalogue)
const hubOpen = useWorkshopFlag(HUB_HOME_FLAG)
</script>

<template>
  <HubAppCatalogue
    v-if="hubOpen"
    :apps
    :upcoming="upcomingApps(locale)"
    :locale
  />
  <AppCatalogue
    v-else
    v-model:browse-all="browseAll"
    :apps
    :locale
    @section="emit('section', $event)"
  >
    <template #tabs>
      <slot name="tabs" />
    </template>
  </AppCatalogue>
</template>
