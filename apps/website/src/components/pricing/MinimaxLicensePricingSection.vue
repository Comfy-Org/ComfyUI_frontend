<script setup lang="ts">
import { computed } from 'vue'

import SectionHeader from '../common/SectionHeader.vue'
import { getRoutes } from '../../config/routes'
import { minimaxLicenseComparison } from '../../data/minimaxLicense'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const licenseHref = computed(() => getRoutes(locale).minimaxLicense)
const { columns, rows } = minimaxLicenseComparison
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('pricing.minimaxLicense.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700">
          {{ t('pricing.minimaxLicense.description', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div
      class="bg-transparency-white-t4 mx-auto mt-8 max-w-6xl rounded-4xl px-5 py-6 lg:px-8"
    >
      <div class="scrollbar-none overflow-x-auto">
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

      <p class="mt-2 px-2">
        <a
          :href="licenseHref"
          class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
        >
          {{ t('pricing.minimaxLicense.cta', locale) }}
        </a>
      </p>
    </div>
  </section>
</template>
