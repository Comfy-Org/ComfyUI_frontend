<script setup lang="ts">
import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import CatalogueBackLink from './CatalogueBackLink.vue'
import HubBreadcrumb from './HubBreadcrumb.vue'

const { name } = defineProps<{ name: string }>()
const routes = getRoutes()
const crumbs = [
  { label: t('workshop.catalogue.eyebrow'), href: routes.hubExplore },
  { label: t('workshop.model.breadcrumb'), href: routes.workshop },
  { label: name }
]
</script>

<template>
  <div
    class="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 pt-10 lg:px-8"
    data-testid="model-file-trail"
  >
    <CatalogueBackLink />
    <HubBreadcrumb :crumbs class="max-sm:hidden" />
  </div>
</template>
