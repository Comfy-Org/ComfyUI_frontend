<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchRateCard } from './types'

import BrandButton from '../../components/common/BrandButton.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', rateCard } = defineProps<{
  rateCard: ModelLaunchRateCard
  locale?: Locale
}>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(rateCard.headingKey, locale) }}
      </h2>
      <p
        v-if="rateCard.subtitleKey"
        class="text-[17px]/relaxed font-light text-primary-comfy-canvas"
      >
        {{ t(rateCard.subtitleKey, locale) }}
      </p>
    </div>

    <div class="rounded-5xl bg-transparency-white-t4 mt-12 p-4 lg:p-2">
      <div class="rounded-4.5xl overflow-x-auto bg-primary-comfy-ink">
        <table class="w-full min-w-160 border-collapse text-left">
          <thead>
            <tr>
              <td class="p-6 lg:px-8"></td>
              <th
                v-for="column in rateCard.columns"
                :key="column.id"
                scope="col"
                class="w-1/3 p-6 align-bottom lg:px-8"
              >
                <p
                  class="text-primary-comfy-yellow text-sm/tight font-extrabold tracking-wider uppercase"
                >
                  {{ column.name[locale] }}
                </p>
                <p class="mt-3 text-3xl font-medium text-primary-warm-white">
                  {{ column.price[locale] }}
                </p>
                <p
                  v-if="column.priceNote"
                  class="mt-1 text-sm/snug font-light text-primary-comfy-canvas"
                >
                  {{ column.priceNote[locale] }}
                </p>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rateCard.rows"
              :key="row.id"
              class="border-t border-transparency-white-t8"
            >
              <th
                scope="row"
                class="p-6 text-[15px]/snug font-light text-primary-comfy-canvas lg:px-8"
              >
                {{ row.label[locale] }}
              </th>
              <td
                v-for="(value, index) in row.values"
                :key="rateCard.columns[index]?.id ?? index"
                class="p-6 text-[15px]/snug font-medium text-primary-warm-white lg:px-8"
              >
                {{ value[locale] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p
      v-if="rateCard.footnote"
      class="mx-auto mt-6 max-w-3xl text-center text-sm/relaxed font-light text-primary-comfy-canvas"
    >
      {{ rateCard.footnote[locale] }}
    </p>

    <div v-if="rateCard.primaryCta" class="mt-10 flex justify-center">
      <BrandButton
        :href="rateCard.primaryCta.href"
        :target="rateCard.primaryCta.target"
        variant="solid"
        size="lg"
        class="w-full p-4 text-center sm:w-auto sm:min-w-52"
      >
        {{ t(rateCard.primaryCta.labelKey, locale) }}
      </BrandButton>
    </div>
  </section>
</template>
