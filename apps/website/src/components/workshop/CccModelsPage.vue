<script setup lang="ts">
import { provide } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import type {
  CatalogListPages,
  CatalogListFacets
} from '@/lib/cms/catalog-list'
import type { Locale } from '@/i18n/translations'
import AppCatalogue from './AppCatalogue.vue'
import { cccCatalogueComponents } from './ccc-catalogue-components'
import type { CatalogueTab } from './CatalogueTabs.vue'
import ModelsCatalogue from './ModelsCatalogue.vue'
import ModelsPage from './ModelsPage.vue'
import WorkflowCatalogue from './WorkflowCatalogue.vue'

defineOptions({ inheritAttrs: false })

defineProps<{
  slug?: string
  workflowId?: string
  heading?: string
  section?: CatalogueTab
  initialModels?: readonly WorkshopModel[]
  initialCatalogAvailable?: boolean
  initialHeadings?: Readonly<Record<CatalogueTab, string>>
  initialPages?: CatalogListPages
  initialFacets?: CatalogListFacets
  initialSearch?: string
  locale?: Locale
}>()

provide(cccCatalogueComponents, {
  catalogue: ModelsCatalogue,
  workflows: WorkflowCatalogue,
  apps: AppCatalogue
})
</script>

<template>
  <ModelsPage v-bind="$props">
    <template #fallback><slot name="fallback" /></template>
  </ModelsPage>
</template>
