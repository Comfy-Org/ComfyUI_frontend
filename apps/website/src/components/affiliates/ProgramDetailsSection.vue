<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import SectionHeader from '../common/SectionHeader.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const rows: { labelKey: TranslationKey; valueKey: TranslationKey }[] = [
  {
    labelKey: 'affiliate-landing.details.row.0.label',
    valueKey: 'affiliate-landing.details.row.0.value'
  },
  {
    labelKey: 'affiliate-landing.details.row.1.label',
    valueKey: 'affiliate-landing.details.row.1.value'
  },
  {
    labelKey: 'affiliate-landing.details.row.2.label',
    valueKey: 'affiliate-landing.details.row.2.value'
  },
  {
    labelKey: 'affiliate-landing.details.row.3.label',
    valueKey: 'affiliate-landing.details.row.3.value'
  },
  {
    labelKey: 'affiliate-landing.details.row.4.label',
    valueKey: 'affiliate-landing.details.row.4.value'
  },
  {
    labelKey: 'affiliate-landing.details.row.5.label',
    valueKey: 'affiliate-landing.details.row.5.value'
  }
]
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
            <tr class="border-primary-comfy-canvas/20 border-b">
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
              v-for="row in rows"
              :key="row.labelKey"
              class="border-primary-comfy-canvas/10 border-b"
            >
              <th
                scope="row"
                class="text-primary-comfy-canvas py-5 pr-6 text-base font-light"
              >
                {{ t(row.labelKey, locale) }}
              </th>
              <td class="text-primary-comfy-canvas/80 py-5 text-base">
                {{ t(row.valueKey, locale) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl class="flex flex-col gap-6 md:hidden">
        <div
          v-for="row in rows"
          :key="row.labelKey"
          class="border-primary-comfy-canvas/10 flex flex-col gap-1 border-b pb-4"
        >
          <dt
            class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
          >
            {{ t(row.labelKey, locale) }}
          </dt>
          <dd class="text-primary-comfy-canvas text-base">
            {{ t(row.valueKey, locale) }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
