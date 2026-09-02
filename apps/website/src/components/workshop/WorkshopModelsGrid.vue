<script setup lang="ts">
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X
} from '@lucide/vue'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type {
  ModalityFilter,
  SortOrder,
  TaskInput,
  WorkshopModel
} from '../../config/workshop'
import {
  MODALITY_FILTERS,
  SORT_ORDERS,
  countByFacet,
  countByModality,
  filterWorkshopModels,
  sortWorkshopModels,
  splitTask
} from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
const modalities = ref<string[]>([])
const providers = ref<string[]>([])
const tasks = ref<string[]>([])
const sort = ref<SortOrder>('popular')

const counts = computed(() => countByModality(models))
const modalityOptions = computed(() =>
  MODALITY_FILTERS.filter(
    (filter) => filter !== 'all' && counts.value[filter] > 0
  )
)
const providerOptions = computed(() => countByFacet(models, 'provider'))
const taskOptions = computed(() => countByFacet(models, 'task'))

const visible = computed(() =>
  sortWorkshopModels(
    filterWorkshopModels(models, {
      query: query.value,
      modalities: modalities.value,
      providers: providers.value,
      tasks: tasks.value
    }),
    sort.value
  )
)
const activeFilterCount = computed(
  () => modalities.value.length + providers.value.length + tasks.value.length
)
const isFiltered = computed(
  () => query.value !== '' || activeFilterCount.value > 0
)

function toggle(list: Ref<string[]>, value: string) {
  list.value = list.value.includes(value)
    ? list.value.filter((item) => item !== value)
    : [...list.value, value]
}
const toggleModality = (value: string) => toggle(modalities, value)
const toggleTask = (value: string) => toggle(tasks, value)
const toggleProvider = (value: string) => toggle(providers, value)

function clearFilters() {
  query.value = ''
  modalities.value = []
  providers.value = []
  tasks.value = []
}

const filterLabelKey: Record<ModalityFilter, TranslationKey> = {
  all: 'workshop.filter.all',
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

const triggerClass = (active: boolean) =>
  cn(
    'hover:bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
    active
      ? 'border-primary-comfy-yellow text-primary-warm-white'
      : 'border-transparency-white-t20 text-primary-comfy-canvas'
  )
const menuClass =
  'border-primary-comfy-ink-light bg-site-dropdown z-50 max-h-[70vh] w-64 overflow-y-auto rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-comfy-canvas outline-none select-none data-[highlighted]:bg-transparency-white-t8'
const groupLabelClass =
  'px-3 pt-2 pb-1 text-[10px] font-bold tracking-widest text-primary-warm-gray uppercase'
const checkClass = (checked: boolean) =>
  cn(
    'grid size-4 shrink-0 place-items-center rounded-sm border',
    checked
      ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
      : 'border-transparency-white-t20'
  )
</script>

<template>
  <section>
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
        <DropdownMenuRoot>
          <DropdownMenuTrigger
            data-testid="workshop-filter"
            :class="triggerClass(activeFilterCount > 0)"
          >
            <SlidersHorizontal class="size-4" aria-hidden="true" />
            {{ t('workshop.filter.button', locale) }}
            <span
              v-if="activeFilterCount"
              class="bg-primary-comfy-yellow rounded-full px-1.5 text-[10px] font-bold text-primary-comfy-ink"
              data-testid="workshop-filter-count"
            >
              {{ activeFilterCount }}
            </span>
            <ChevronDown class="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              align="end"
              :side-offset="8"
              :class="menuClass"
            >
              <DropdownMenuLabel :class="groupLabelClass">
                {{ t('workshop.filter.modality', locale) }}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                v-for="option in modalityOptions"
                :key="option"
                :model-value="modalities.includes(option)"
                :data-testid="`filter-modality-${option}`"
                :class="itemClass"
                @select.prevent
                @update:model-value="toggleModality(option)"
              >
                <span :class="checkClass(modalities.includes(option))">
                  <Check
                    v-if="modalities.includes(option)"
                    class="size-3"
                    aria-hidden="true"
                  />
                </span>
                <span class="flex-1">
                  {{ t(filterLabelKey[option], locale) }}
                </span>
                <span class="text-primary-warm-gray">{{ counts[option] }}</span>
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator
                class="my-2 h-px bg-transparency-white-t8"
              />
              <DropdownMenuLabel :class="groupLabelClass">
                {{ t('workshop.filter.taskGroup', locale) }}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                v-for="option in taskOptions"
                :key="option.value"
                :model-value="tasks.includes(option.value)"
                :data-testid="`filter-task-${option.value}`"
                :class="itemClass"
                @select.prevent
                @update:model-value="toggleTask(option.value)"
              >
                <span :class="checkClass(tasks.includes(option.value))">
                  <Check
                    v-if="tasks.includes(option.value)"
                    class="size-3"
                    aria-hidden="true"
                  />
                </span>
                <span class="flex-1">{{ taskLabel(option.value) }}</span>
                <span class="text-primary-warm-gray">{{ option.count }}</span>
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator
                class="my-2 h-px bg-transparency-white-t8"
              />
              <DropdownMenuLabel :class="groupLabelClass">
                {{ t('workshop.filter.providerGroup', locale) }}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                v-for="option in providerOptions"
                :key="option.value"
                :model-value="providers.includes(option.value)"
                :data-testid="`filter-provider-${option.value}`"
                :class="itemClass"
                @select.prevent
                @update:model-value="toggleProvider(option.value)"
              >
                <span :class="checkClass(providers.includes(option.value))">
                  <Check
                    v-if="providers.includes(option.value)"
                    class="size-3"
                    aria-hidden="true"
                  />
                </span>
                <span class="flex-1">{{ option.value }}</span>
                <span class="text-primary-warm-gray">{{ option.count }}</span>
              </DropdownMenuCheckboxItem>

              <template v-if="activeFilterCount">
                <DropdownMenuSeparator
                  class="my-2 h-px bg-transparency-white-t8"
                />
                <DropdownMenuItem
                  :class="cn(itemClass, 'text-primary-warm-gray')"
                  data-testid="workshop-filter-clear"
                  @select="clearFilters"
                >
                  {{ t('workshop.empty.clear', locale) }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>

        <DropdownMenuRoot>
          <DropdownMenuTrigger
            data-testid="workshop-sort"
            :aria-label="t('workshop.sort.label', locale)"
            :class="triggerClass(false)"
          >
            <ArrowUpDown class="size-4" aria-hidden="true" />
            {{ t(sortLabelKey[sort], locale) }}
            <ChevronDown class="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              align="end"
              :side-offset="8"
              :class="menuClass"
            >
              <DropdownMenuRadioGroup v-model="sort">
                <DropdownMenuRadioItem
                  v-for="order in SORT_ORDERS"
                  :key="order"
                  :value="order"
                  :data-testid="`sort-${order}`"
                  :class="itemClass"
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

    <p
      class="mb-4 text-xs text-primary-warm-gray"
      aria-live="polite"
      data-testid="workshop-count"
    >
      {{ visible.length }} {{ t('workshop.count.models', locale) }}
    </p>

    <div v-if="visible.length">
      <ul
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="workshop-models-grid"
      >
        <li v-for="model in visible" :key="model.slug">
          <WorkshopModelCard :model :locale />
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
