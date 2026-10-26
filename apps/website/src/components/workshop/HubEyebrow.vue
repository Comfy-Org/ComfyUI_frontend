<script setup lang="ts">
import { computed } from 'vue'

import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { HubSection } from '@/lib/workshop/hub-section'
import HubBreadcrumb from './HubBreadcrumb.vue'

const { section } = defineProps<{ section: HubSection }>()

const routes = getRoutes('en')
const CRUMB_KEY = {
  models: 'workshop.hero.eyebrow',
  workflows: 'workshop.hub.workflows',
  apps: 'workshop.catalogue.apps'
} as const
const crumbs = computed(() =>
  section === 'explore'
    ? undefined
    : [
        {
          label: t('workshop.catalogue.eyebrow'),
          href: routes.hubExplore,
          testId: 'hub-back'
        },
        { label: t(CRUMB_KEY[section]) }
      ]
)
</script>

<template>
  <HubBreadcrumb v-if="crumbs" :crumbs class="mb-8 max-sm:mb-5" />
</template>
