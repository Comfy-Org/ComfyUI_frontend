<script setup lang="ts">
import type { SortOrder, UseCase } from '@/config/models-catalogue'
import { SORT_ORDERS } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import type { ModelAccess } from '@/lib/workshop/explorer/model-access'
import type { Resolution } from '@/lib/workshop/resolution'
import type { FacetMenuOption } from '@/components/workshop/WorkshopFilterMenu.vue'
import WorkshopFilterMenu from '@/components/workshop/WorkshopFilterMenu.vue'
import WorkshopSortMenu from '@/components/workshop/WorkshopSortMenu.vue'
import BestForMenu from './BestForMenu.vue'
import ResolutionMenu from './ResolutionMenu.vue'

const {
  useCaseOptions,
  resolutionOptions,
  accessOptions,
  resultCount,
  locale = 'en'
} = defineProps<{
  useCaseOptions: readonly FacetMenuOption[]
  resolutionOptions: readonly FacetMenuOption<Resolution>[]
  accessOptions: readonly FacetMenuOption<ModelAccess>[]
  resultCount: number
  locale?: Locale
}>()

const useCases = defineModel<UseCase[]>('useCases', { required: true })
const resolution = defineModel<Resolution | undefined>('resolution', {
  required: true
})
const access = defineModel<ModelAccess[]>('access', { required: true })
const sort = defineModel<SortOrder>('sort', { required: true })
</script>

<template>
  <div
    class="flex items-center gap-2 max-sm:order-last max-sm:-mx-1 max-sm:basis-full max-sm:overflow-x-auto max-sm:px-1"
    data-testid="workshop-dropdowns"
  >
    <BestForMenu
      v-if="useCaseOptions.length"
      v-model="useCases"
      :options="useCaseOptions"
      :locale
      data-design-decision="models-filters"
    />
    <ResolutionMenu
      v-if="resolutionOptions.length"
      v-model="resolution"
      :options="resolutionOptions"
      :locale
    />
  </div>

  <div class="flex items-center gap-2" data-testid="workshop-filters">
    <WorkshopFilterMenu
      v-if="accessOptions.length"
      v-model:access="access"
      :access-options="accessOptions"
      :result-count
      :locale
    />

    <WorkshopSortMenu v-model="sort" :orders="SORT_ORDERS" :locale />
  </div>
</template>
