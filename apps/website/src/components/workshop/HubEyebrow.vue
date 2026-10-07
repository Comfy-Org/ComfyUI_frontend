<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { HubSection } from '@/lib/workshop/hub-section'
import HubBreadcrumb from './HubBreadcrumb.vue'
import { workshopEyebrowClass } from './workshopHeadingClasses'

const { section } = defineProps<{ section: HubSection }>()

const routes = getRoutes('en')
const CRUMB_KEY = {
  workflows: 'workshop.hub.workflows',
  apps: 'workshop.catalogue.apps'
} as const
const crumbs =
  section === 'workflows' || section === 'apps'
    ? [
        {
          label: t('workshop.catalogue.eyebrow'),
          href: routes.hubExplore,
          testId: 'hub-back'
        },
        { label: t(CRUMB_KEY[section]) }
      ]
    : undefined
</script>

<template>
  <template v-if="crumbs">
    <HubBreadcrumb :crumbs class="mb-8 max-sm:mb-5" />
    <p :class="workshopEyebrowClass">
      {{ t('workshop.catalogue.eyebrow') }}
    </p>
  </template>
  <p v-else-if="section === 'explore'" :class="workshopEyebrowClass">
    {{ t('workshop.catalogue.eyebrow') }}
  </p>
  <a
    v-else
    :href="routes.hubExplore"
    :class="
      cn(
        workshopEyebrowClass,
        'group inline-flex items-center gap-1 rounded-lg outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
      )
    "
    data-testid="hub-back"
  >
    <ChevronLeft
      class="size-4 transition-transform group-hover:-translate-x-0.5"
      aria-hidden="true"
    />
    {{ t('workshop.catalogue.eyebrow') }}
  </a>
</template>
