<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { groupModels } from '@/config/model-family'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { SHELF_CARD } from '@/lib/workshop/card-layout'
import type { HubTaskEntry, HubTaskKey } from '@/lib/workshop/hub-tasks'
import { hubTaskLabelKey, hubTaskOf } from '@/lib/workshop/hub-tasks'
import CardRow from './CardRow.vue'
import HubRowSeen from './HubRowSeen.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'

const ROW_LIMIT = 8
const OTHER_ROW = 'other' as const

const {
  models,
  entries,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  entries: readonly HubTaskEntry[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  select: [key: HubTaskKey]
  pick: [model: WorkshopModel, event: MouseEvent, row: string, position: number]
}>()

const titleClass =
  'cursor-pointer rounded-lg text-xl font-medium text-primary-warm-white transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
const seeAllClass =
  'group inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg text-sm font-medium text-primary-warm-gray transition-colors outline-none hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'

const rows = computed(() => {
  const byLeaf = Map.groupBy(
    models,
    (model): HubTaskKey | typeof OTHER_ROW => hubTaskOf(model) ?? OTHER_ROW
  )
  const row = (
    key: HubTaskKey | typeof OTHER_ROW,
    label: string,
    selectable?: HubTaskKey
  ) => {
    const families = groupModels(byLeaf.get(key) ?? [])
    return {
      key,
      label,
      selectable,
      total: families.length,
      shown: families.slice(0, ROW_LIMIT)
    }
  }
  const leaves = entries.map((entry) => entry.key)
  return [
    ...leaves.map((key) => row(key, t(hubTaskLabelKey[key]), key)),
    row(OTHER_ROW, t('workshop.filter.other'))
  ].filter((listed) => listed.total > 0)
})
</script>

<template>
  <div class="flex flex-col gap-12" data-testid="hub-task-rows">
    <section
      v-for="row in rows"
      :key="row.key"
      :aria-labelledby="`task-row-${row.key}`"
      :data-testid="`task-row-${row.key}`"
    >
      <CardRow :locale>
        <template #heading>
          <h2 :id="`task-row-${row.key}`">
            <button
              v-if="row.selectable"
              type="button"
              :class="titleClass"
              @click="emit('select', row.selectable)"
            >
              {{ row.label }}
            </button>
            <span v-else class="text-xl font-medium text-primary-warm-white">
              {{ row.label }}
            </span>
          </h2>
        </template>

        <template #actions>
          <button
            v-if="row.selectable && row.total > ROW_LIMIT"
            type="button"
            :class="seeAllClass"
            :data-testid="`task-row-${row.key}-see-all`"
            @click="emit('select', row.selectable)"
          >
            <span class="tabular-nums">
              {{ t('workshop.taskSidebar.seeAll', { n: row.total }) }}
            </span>
            <ChevronRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </template>

        <li
          v-for="(family, index) in row.shown"
          :key="family.key"
          :class="SHELF_CARD"
        >
          <WorkshopModelCard
            :model="family.latest"
            :locale
            @click="emit('pick', family.latest, $event, row.key, index)"
          />
        </li>
      </CardRow>
      <HubRowSeen
        :view="{
          surface: 'models',
          source: 'use_case_row',
          row: row.key,
          rowSlugs: row.shown.map((family) => family.latest.slug)
        }"
      />
    </section>
  </div>
</template>
