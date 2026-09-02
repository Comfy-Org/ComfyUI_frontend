<script setup lang="ts">
import { ArrowUpDown, Check, ChevronDown, Search, X } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import { cn } from '@comfyorg/tailwind-utils'

import type {
  ModalityFilter,
  SortOrder,
  TaskInput,
  UseCase,
  WorkshopModel
} from '../../config/workshop'
import {
  SORT_ORDERS,
  USE_CASES,
  countByFacet,
  countByUseCase,
  filterWorkshopModels,
  sortWorkshopModels,
  splitTask
} from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { FacetMenuOption } from './WorkshopFacetMenu.vue'
import WorkshopFacetMenu from './WorkshopFacetMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
const useCase = ref<UseCase | 'all'>('all')
const tasks = ref<string[]>([])
const providers = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const { showStatuses } = usePrototypeTweaks()

const useCaseLabelKey: Record<UseCase | 'all', TranslationKey> = {
  all: 'workshop.useCase.all',
  'create-images': 'workshop.useCase.createImages',
  'edit-images': 'workshop.useCase.editImages',
  'create-videos': 'workshop.useCase.createVideos',
  'edit-videos': 'workshop.useCase.editVideos',
  'create-3d': 'workshop.useCase.create3d',
  audio: 'workshop.useCase.audio',
  text: 'workshop.useCase.text',
  other: 'workshop.useCase.other'
}
const filterLabelKey: Record<Exclude<ModalityFilter, 'all'>, TranslationKey> = {
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d',
  text: 'workshop.filter.text',
  other: 'workshop.filter.other'
}
const inputLabelKey: Record<TaskInput, TranslationKey> = {
  text: 'workshop.input.text',
  image: 'workshop.input.image',
  video: 'workshop.input.video',
  audio: 'workshop.input.audio'
}
const sortLabelKey: Record<SortOrder, TranslationKey> = {
  popular: 'workshop.sort.popular',
  name: 'workshop.sort.name',
  priceAsc: 'workshop.sort.priceAsc',
  priceDesc: 'workshop.sort.priceDesc'
}

function taskLabel(value: string): string {
  const parts = splitTask(value)
  return parts
    ? `${t(inputLabelKey[parts.input], locale)} → ${t(filterLabelKey[parts.output], locale)}`
    : value
}

const counts = computed(() => countByUseCase(models))
const useCases = computed(() =>
  (['all', ...USE_CASES] as const).filter((value) => counts.value[value] > 0)
)
const taskOptions = computed<FacetMenuOption[]>(() =>
  countByFacet(models, 'task').map((option) => ({
    ...option,
    label: taskLabel(option.value)
  }))
)
const providerOptions = computed<FacetMenuOption[]>(() =>
  countByFacet(models, 'provider').map((option) => ({
    ...option,
    label: option.value
  }))
)

const visible = computed(() =>
  sortWorkshopModels(
    filterWorkshopModels(models, {
      query: query.value,
      useCase: useCase.value,
      providers: providers.value,
      tasks: tasks.value
    }),
    sort.value
  )
)
const isFiltered = computed(
  () =>
    query.value !== '' ||
    useCase.value !== 'all' ||
    tasks.value.length + providers.value.length > 0
)

function clearFilters() {
  query.value = ''
  useCase.value = 'all'
  tasks.value = []
  providers.value = []
}

const chipClass = (current: boolean) =>
  cn(
    'focus-visible:ring-primary-comfy-yellow/50 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
    current
      ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
      : 'hover:bg-transparency-white-t4 border-transparency-white-t20 text-primary-comfy-canvas'
  )

const menuItemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-[highlighted]:bg-transparency-white-t8'
</script>

<template>
  <section>
    <div
      class="mb-6 flex flex-wrap gap-2"
      role="group"
      :aria-label="t('workshop.useCase.label', locale)"
      data-testid="workshop-use-cases"
    >
      <button
        v-for="value in useCases"
        :key="value"
        type="button"
        :aria-pressed="useCase === value"
        :data-testid="`use-case-${value}`"
        :class="chipClass(useCase === value)"
        @click="useCase = value"
      >
        {{ t(useCaseLabelKey[value], locale) }}
        <span
          :class="
            cn(
              'text-xs tabular-nums',
              useCase === value
                ? 'text-primary-comfy-ink/70'
                : 'text-primary-warm-gray'
            )
          "
          >{{ counts[value] }}</span
        >
      </button>
    </div>

    <div
      class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="relative w-full lg:max-w-sm">
        <label for="workshop-search" class="sr-only">
          {{ t('workshop.search.label', locale) }}
        </label>
        <Search
          class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray"
          aria-hidden="true"
        />
        <input
          id="workshop-search"
          v-model="query"
          type="search"
          :placeholder="t('workshop.search.label', locale)"
          data-testid="workshop-search"
          class="bg-transparency-white-t4 focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-2xl border border-transparency-white-t20 pr-10 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          v-if="query"
          type="button"
          :aria-label="t('workshop.search.clear', locale)"
          data-testid="workshop-search-clear"
          class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-primary-warm-gray hover:text-primary-warm-white"
          @click="query = ''"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div class="flex flex-wrap gap-2" data-testid="workshop-filters">
        <WorkshopFacetMenu
          v-model="tasks"
          facet="task"
          :label="t('workshop.filter.taskGroup', locale)"
          :options="taskOptions"
          :locale
        />
        <WorkshopFacetMenu
          v-model="providers"
          facet="provider"
          :label="t('workshop.filter.providerGroup', locale)"
          :options="providerOptions"
          :locale
          searchable
        />

        <DropdownMenuRoot>
          <DropdownMenuTrigger
            data-testid="workshop-sort"
            :aria-label="t('workshop.sort.label', locale)"
            class="hover:bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-transparency-white-t20 px-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none focus-visible:ring-3"
          >
            <ArrowUpDown class="size-4" aria-hidden="true" />
            {{ t(sortLabelKey[sort], locale) }}
            <ChevronDown class="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              align="end"
              :side-offset="8"
              class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-64 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
            >
              <DropdownMenuRadioGroup v-model="sort">
                <DropdownMenuRadioItem
                  v-for="order in SORT_ORDERS"
                  :key="order"
                  :value="order"
                  :data-testid="`sort-${order}`"
                  :class="menuItemClass"
                >
                  <span class="flex-1">{{
                    t(sortLabelKey[order], locale)
                  }}</span>
                  <Check
                    v-if="sort === order"
                    class="text-primary-comfy-yellow size-4"
                    aria-hidden="true"
                  />
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </div>

    <div v-if="visible.length">
      <ul
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="workshop-models-grid"
      >
        <li v-for="model in visible" :key="model.slug">
          <WorkshopModelCard :model :locale :show-status="showStatuses" />
        </li>
      </ul>
    </div>

    <div
      v-else
      class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-transparency-white-t8 px-6 py-16 text-center"
      data-testid="workshop-empty"
    >
      <p class="text-lg font-semibold text-primary-comfy-canvas">
        {{ t('workshop.empty.heading', locale) }}
      </p>
      <p class="text-sm text-primary-warm-gray">
        {{ t('workshop.empty.body', locale) }}
      </p>
      <Button
        v-if="isFiltered"
        variant="outline"
        size="sm"
        @click="clearFilters"
      >
        {{ t('workshop.empty.clear', locale) }}
      </Button>
    </div>
  </section>
</template>
