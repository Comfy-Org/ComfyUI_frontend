<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionHeader from '../common/SectionHeader.vue'
import { programDetailRows } from './programDetails'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section
    class="px-6 py-20 md:px-20 md:py-28"
    data-testid="affiliate-program-details"
  >
    <SectionHeader>
      {{ t('affiliate-landing.details.heading', locale) }}
    </SectionHeader>
    <div class="mx-auto mt-12 max-w-3xl">
      <div class="hidden md:block">
        <table
          class="w-full border-collapse text-left"
          data-testid="affiliate-program-details-table"
        >
          <thead>
            <tr class="border-b border-primary-comfy-canvas/20">
              <th
                scope="col"
                class="text-primary-comfy-yellow py-4 pr-6 text-xs font-bold tracking-widest uppercase"
              >
                {{ t('affiliate-landing.details.headerLabel', locale) }}
              </th>
              <th
                scope="col"
                class="text-primary-comfy-yellow py-4 text-xs font-bold tracking-widest uppercase"
              >
                {{ t('affiliate-landing.details.headerValue', locale) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in programDetailRows"
              :key="row.labelKey"
              class="border-b border-primary-comfy-canvas/10"
            >
              <th
                scope="row"
                class="py-5 pr-6 text-base font-light text-primary-comfy-canvas"
              >
                {{ t(row.labelKey, locale) }}
              </th>
              <td class="py-5 text-base text-primary-comfy-canvas/80">
                {{ t(row.valueKey, locale) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl class="flex flex-col gap-6 md:hidden">
        <div
          v-for="row in programDetailRows"
          :key="row.labelKey"
          class="flex flex-col gap-1 border-b border-primary-comfy-canvas/10 pb-4"
        >
          <dt
            class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
          >
            {{ t(row.labelKey, locale) }}
          </dt>
          <dd class="text-base text-primary-comfy-canvas">
            {{ t(row.valueKey, locale) }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
