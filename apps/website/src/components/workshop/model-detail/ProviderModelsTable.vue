<script setup lang="ts">
import { computed } from 'vue'

import type { ProviderModelRow } from '@/config/models-page-data'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { splitPriceLabel } from '@/lib/workshop/price-label'
import ProviderMark from './ProviderMark.vue'

const {
  provider,
  rows,
  locale = 'en'
} = defineProps<{
  provider: string
  rows: readonly ProviderModelRow[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

interface Cell {
  readonly key: string
  readonly value?: string
  readonly unit?: string
}

function durationLabel({
  min,
  max
}: NonNullable<ProviderModelRow['duration']>) {
  if (min === undefined)
    return t('workshop.model.providerTable.durationUpTo', { max })
  return min === max
    ? t('workshop.model.providerTable.durationOne', { n: max })
    : t('workshop.model.providerTable.durationRange', { min, max })
}

function cellsOf(row: ProviderModelRow): Cell[] {
  const price = row.price ? splitPriceLabel(row.price) : undefined
  return [
    { key: 'price', value: price?.amount, unit: price?.per },
    { key: 'resolution', value: row.resolution },
    {
      key: 'duration',
      value: row.duration ? durationLabel(row.duration) : undefined
    }
  ]
}

const tableRows = computed(() =>
  rows.map((row) => ({ row, cells: cellsOf(row) }))
)

const COLUMNS = [
  'workshop.model.providerTable.model',
  'workshop.model.providerTable.price',
  'workshop.model.providerTable.resolution',
  'workshop.model.providerTable.duration'
] as const
</script>

<template>
  <section
    v-if="rows.length"
    aria-labelledby="provider-models-heading"
    class="mt-24 border-t border-transparency-white-t8 pt-12"
    data-testid="related-models"
  >
    <h2
      id="provider-models-heading"
      class="text-2xl font-bold text-primary-comfy-canvas"
    >
      {{ t('workshop.model.relatedProvider', { provider }) }}
    </h2>
    <p class="mt-2 max-w-3xl text-sm/relaxed text-primary-warm-gray">
      {{ t('workshop.model.providerTable.subtitle', { provider }) }}
    </p>
    <div
      class="mt-6 overflow-x-auto rounded-2xl border border-transparency-white-t8"
    >
      <table class="w-full min-w-xl text-left text-sm">
        <thead class="bg-hub-surface text-xs text-primary-warm-gray">
          <tr>
            <th
              v-for="column in COLUMNS"
              :key="column"
              scope="col"
              class="px-5 py-3 font-medium"
            >
              {{ t(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ row, cells } in tableRows"
            :key="row.slug"
            class="relative border-t border-transparency-white-t8 transition-colors hover:bg-hub-surface"
            data-testid="provider-model-row"
          >
            <th scope="row" class="px-5 py-4 font-medium">
              <a
                :href="row.href"
                class="flex items-center gap-3 text-content-bright outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-primary-comfy-yellow/50"
              >
                <ProviderMark :provider />
                {{ row.name }}
              </a>
            </th>
            <td
              v-for="cell in cells"
              :key="cell.key"
              class="px-5 py-4 whitespace-nowrap text-primary-warm-white"
            >
              <template v-if="cell.value">
                {{ cell.value
                }}<span class="text-primary-warm-gray">{{ cell.unit }}</span>
              </template>
              <span v-else class="text-primary-warm-gray">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
