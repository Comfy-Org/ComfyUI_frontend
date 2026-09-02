<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import { minimaxLicenseComparison } from '../../data/minimaxLicense'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const licenseHref = getRoutes(locale).minimaxLicense
const { columns, rows } = minimaxLicenseComparison
</script>

<template>
  <div
    class="bg-transparency-white-t4 mx-auto mt-4 max-w-6xl rounded-4xl px-5 py-6 lg:px-8"
  >
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p
        class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
      >
        {{ t('pricing.resourceCosts.minimaxLicense.eyebrow', locale) }}
      </p>
      <a
        :href="licenseHref"
        class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 shrink-0 rounded-sm text-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
      >
        {{ t('pricing.resourceCosts.minimaxLicense.cta', locale) }}
      </a>
    </div>

    <div class="mt-2 scrollbar-none overflow-x-auto">
      <table class="w-full min-w-130 text-left text-sm">
        <thead>
          <tr
            class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
          >
            <th class="px-2 py-4" scope="col"></th>
            <th
              v-for="column in columns"
              :key="column.id"
              class="p-4"
              scope="col"
            >
              {{ column.label[locale] || column.label.en }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <th
              class="px-2 py-3.5 text-sm font-normal text-primary-warm-white"
              scope="row"
            >
              {{ row.label[locale] || row.label.en }}
            </th>
            <td
              v-for="(cell, index) in row.cells"
              :key="columns[index]?.id ?? index"
              class="px-4 py-3.5 text-sm text-primary-warm-gray"
            >
              {{ cell[locale] || cell.en }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-2 px-2 text-xs text-primary-warm-gray">
      {{ t('pricing.resourceCosts.minimaxLicense.description', locale) }}
    </p>
  </div>
</template>
