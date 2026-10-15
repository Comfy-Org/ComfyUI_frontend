<script setup lang="ts">
import { useMounted } from '@vueuse/core'
import { computed } from 'vue'

import { catalogSearch, useCaseFor } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type {
  RouterWorkshopModelDetail,
  WorkshopModel
} from '@/config/models-catalogue'
import type { ProviderModelRow } from '@/config/models-page-data'
import { formForContract } from '@/config/workshop-contract'
import { pagePaths } from '@/lib/workshop/page-paths'
import { t } from '@/i18n/translations'
import { useWorkshopWorkflowsEnabled } from '@/scripts/posthog'
import { SHELF_CARD } from '@/lib/workshop/card-layout'
import CardRow from './CardRow.vue'
import DetailTrail from './DetailTrail.vue'
import ModelPrice from './ModelPrice.vue'
import ModelDetail from './ModelDetail.vue'
import ProviderModelsTable from './model-detail/ProviderModelsTable.vue'
import ModelPaths from './model-detail/ModelPaths.vue'
import ModelStatus from './ModelStatus.vue'
import ModelSupport from './ModelSupport.vue'
import TagOverflow from './TagOverflow.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

interface ModelTag {
  label: string
  search: string
}

const { page } = defineProps<{
  page: {
    model: RouterWorkshopModelDetail
    providerModels: readonly ProviderModelRow[]
    successor?: WorkshopModel
    priceEstimate?: string
    useCaseLabel?: string
    workflows: readonly WorkshopModel[]
    shownTags: readonly ModelTag[]
    restTags: readonly ModelTag[]
    restTagCount: number
  }
}>()
const routes = getRoutes()
const model = computed(() =>
  page.model.execution
    ? { ...page.model, form: formForContract(page.model.execution) }
    : page.model
)
const paths = computed(() => pagePaths(page.model))
const modelUseCase = computed(() => useCaseFor(page.model))
const mounted = useMounted()
const workflowsEnabled = useWorkshopWorkflowsEnabled()
const showsWorkflows = computed(
  () => mounted.value && workflowsEnabled.value && page.workflows.length > 0
)
const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
const restTags = computed(() =>
  page.restTags.map((tag) => ({
    label: tag.label,
    href: `${routes.workshop}${tag.search}`
  }))
)
</script>

<template>
  <div class="mx-auto max-w-10xl px-6 py-10 lg:px-8 lg:py-14">
    <div class="mb-8 sm:px-8 lg:px-10" data-testid="model-trail">
      <DetailTrail section="models" :name="page.model.name" />
    </div>
    <header class="mb-12 sm:mx-8 lg:mx-10" data-testid="model-hero">
      <div
        class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <div class="flex max-w-2xl flex-col gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <p
              class="text-sm leading-none font-medium tracking-widest text-primary-comfy-yellow uppercase"
            >
              {{ page.model.provider ?? t('workshop.card.partnerNode') }}
            </p>
            <ModelSupport
              v-if="page.model.incompleteReason"
              :reason="page.model.incompleteReason"
            />
            <a
              v-if="modelUseCase && page.useCaseLabel"
              :href="`${routes.workshop}${catalogSearch({ useCase: modelUseCase })}`"
              :class="pillClass"
            >
              {{ page.useCaseLabel }}
            </a>
          </div>

          <h1 class="text-3xl font-bold text-primary-comfy-canvas lg:text-4xl">
            {{ page.model.name }}
          </h1>
          <p
            v-if="page.model.summary"
            class="text-sm/relaxed text-primary-warm-gray"
          >
            {{ page.model.summary }}
          </p>
          <ModelPaths :paths class="mt-1" />
        </div>

        <div class="flex flex-col gap-4 lg:items-end">
          <ModelPrice :estimate="page.priceEstimate" />
          <ul
            v-if="page.shownTags.length > 0"
            class="scrollbar-hide flex items-center gap-2 max-sm:overflow-x-auto sm:flex-wrap lg:justify-end"
            data-testid="model-tags"
          >
            <li v-for="tag in page.shownTags" :key="tag.search">
              <a
                :href="`${routes.workshop}${tag.search}`"
                class="inline-flex h-7 shrink-0 items-center rounded-full bg-transparency-white-t8 px-3 text-xs/none whitespace-nowrap text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 hover:text-primary-comfy-yellow"
              >
                {{ tag.label }}
              </a>
            </li>
            <li v-if="page.restTagCount > 0">
              <TagOverflow :tags="restTags" />
            </li>
          </ul>
        </div>
      </div>

      <ModelStatus
        variant="banner"
        :status="page.model.status"
        :successor="page.successor"
      />
    </header>

    <div class="sm:px-8 lg:px-10">
      <ModelDetail :model />

      <section
        v-if="showsWorkflows"
        aria-labelledby="model-workflows-heading"
        class="mt-24 border-t border-transparency-white-t8 pt-12"
        data-testid="model-workflows"
      >
        <CardRow>
          <template #heading>
            <h2
              id="model-workflows-heading"
              class="text-2xl font-bold text-primary-comfy-canvas"
            >
              {{ t('workshop.model.usedBy', { name: page.model.name }) }}
            </h2>
          </template>
          <li
            v-for="workflow in page.workflows"
            :key="workflow.slug"
            :class="SHELF_CARD"
          >
            <WorkshopModelCard :model="workflow" />
          </li>
        </CardRow>
      </section>

      <ProviderModelsTable
        v-if="page.model.provider"
        :provider="page.model.provider"
        :rows="page.providerModels"
      />
    </div>
  </div>
</template>
