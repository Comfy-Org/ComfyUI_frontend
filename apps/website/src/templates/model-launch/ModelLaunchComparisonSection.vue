<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchComparison } from './types'

import { t } from '../../i18n/translations'

const { locale = 'en', comparison } = defineProps<{
  comparison: ModelLaunchComparison
  locale?: Locale
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(comparison.headingKey, locale) }}
      </h2>
    </div>

    <div class="rounded-5xl bg-transparency-white-t4 mt-12 p-4 lg:p-2">
      <div class="rounded-4.5xl overflow-x-auto bg-primary-comfy-ink">
        <table class="w-full min-w-xl border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" class="p-6"></th>
              <th
                v-for="column in comparison.columns"
                :key="column.id"
                scope="col"
                class="text-primary-comfy-yellow p-6 text-sm/tight font-extrabold tracking-wider uppercase"
              >
                {{ column.label[locale] || column.label.en }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in comparison.rows"
              :key="row.id"
              class="border-transparency-white-t4 border-t"
            >
              <th
                scope="row"
                class="p-6 align-top text-[17px]/relaxed font-medium text-primary-warm-white"
              >
                {{ row.label[locale] || row.label.en }}
              </th>
              <td
                v-for="(cell, index) in row.cells"
                :key="comparison.columns[index]?.id ?? index"
                class="p-6 align-top text-[17px]/relaxed font-light text-primary-comfy-canvas"
              >
                {{ cell[locale] || cell.en }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
