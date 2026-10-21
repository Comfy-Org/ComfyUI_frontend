<script setup lang="ts">
import type { SortOrder } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import type { Resolution } from '@/lib/workshop/resolution'
import { HUB_SORT_ORDERS } from '@/lib/workshop/models-hub'
import type { FacetMenuOption } from '@/components/workshop/WorkshopFilterMenu.vue'
import WorkshopFilterMenu from '@/components/workshop/WorkshopFilterMenu.vue'
import WorkshopSortMenu from '@/components/workshop/WorkshopSortMenu.vue'
import ResolutionMenu from './ResolutionMenu.vue'

const {
  resolutionOptions,
  accessOptions,
  resultCount,
  locale = 'en'
} = defineProps<{
  resolutionOptions: readonly FacetMenuOption<Resolution>[]
  accessOptions: readonly FacetMenuOption<ModelAccess>[]
  resultCount: number
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const resolution = defineModel<Resolution | undefined>('resolution', {
  required: true
})
const access = defineModel<ModelAccess[]>('access', { required: true })
const sort = defineModel<SortOrder>('sort', { required: true })
</script>

<template>
  <div
    class="flex items-center gap-3 max-sm:order-last max-sm:-mx-1 max-sm:basis-full max-sm:overflow-x-auto max-sm:px-1"
    data-testid="workshop-dropdowns"
  >
    <ResolutionMenu
      v-if="resolutionOptions.length"
      v-model="resolution"
      :options="resolutionOptions"
      :locale
    />
  </div>

  <div class="flex items-center gap-3" data-testid="workshop-filters">
    <WorkshopFilterMenu
      v-if="accessOptions.length"
      v-model:access="access"
      :access-options="accessOptions"
      :title="t('workshop.filter.label')"
      :result-count
      :locale
    />

    <WorkshopSortMenu v-model="sort" :orders="HUB_SORT_ORDERS" :locale />
  </div>
</template>
