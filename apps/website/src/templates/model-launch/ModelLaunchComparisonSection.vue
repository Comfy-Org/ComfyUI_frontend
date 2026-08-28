<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchComparison } from './types'

import BrandButton from '../../components/common/BrandButton.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', comparison } = defineProps<{
  comparison: ModelLaunchComparison
  locale?: Locale
}>()

const heading = t(comparison.headingKey, locale)

const isLastRow = (index: number) => index === comparison.rows.length - 1

// Below md the table stacks into one block per feature, so the rule that
// separates entries moves off the cells and onto the row.
const rowRule = (index: number) =>
  !isLastRow(index) &&
  'max-md:border-b max-md:border-solid max-md:border-primary-comfy-canvas/15'

const cellRule = (index: number) =>
  !isLastRow(index) &&
  'md:border-b md:border-solid md:border-primary-comfy-canvas/15'
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ heading }}
      </h2>
      <p
        v-if="comparison.subtitleKey"
        class="mt-4 text-[17px]/relaxed font-light text-pretty text-primary-comfy-canvas/55"
      >
        {{ t(comparison.subtitleKey, locale) }}
      </p>
    </div>

    <div class="rounded-5xl bg-transparency-white-t4 mt-12 p-2">
      <div
        class="rounded-4.5xl bg-primary-comfy-ink px-3 py-4 sm:px-6 lg:px-10 lg:py-8"
      >
        <table class="block w-full border-separate border-spacing-0 md:table">
          <caption class="sr-only">
            {{
              heading
            }}
          </caption>
          <thead class="hidden md:table-header-group">
            <tr>
              <td class="w-2/5 px-3 pb-5 sm:px-5"></td>
              <th
                v-for="column in comparison.columns"
                :key="column.id"
                scope="col"
                :class="
                  cn(
                    'px-3 pt-4 pb-5 text-left text-lg font-medium text-primary-warm-white sm:px-5 lg:text-xl',
                    column.featured &&
                      'bg-transparency-white-t4 text-primary-comfy-yellow rounded-t-3xl'
                  )
                "
              >
                {{ column.label[locale] }}
              </th>
            </tr>
          </thead>
          <tbody class="block md:table-row-group">
            <tr
              v-for="(row, index) in comparison.rows"
              :key="row.id"
              :class="cn('block max-md:py-4 md:table-row', rowRule(index))"
            >
              <th
                scope="row"
                :class="
                  cn(
                    'block px-3 text-left text-sm/snug font-normal text-primary-comfy-canvas/55 max-md:pb-2 sm:px-5 md:table-cell md:py-5',
                    cellRule(index)
                  )
                "
              >
                {{ row.label[locale] }}
              </th>
              <td
                v-for="column in comparison.columns"
                :key="column.id"
                :class="
                  cn(
                    'flex items-baseline justify-between gap-4 px-3 py-1 text-sm/snug text-pretty text-primary-comfy-canvas sm:px-5 md:table-cell md:py-5',
                    cellRule(index),
                    column.featured && 'md:bg-transparency-white-t4',
                    column.featured && isLastRow(index) && 'md:rounded-b-3xl'
                  )
                "
              >
                <span
                  :class="
                    cn(
                      'shrink-0 md:hidden',
                      column.featured
                        ? 'text-primary-comfy-yellow'
                        : 'text-primary-comfy-canvas/55'
                    )
                  "
                >
                  {{ column.label[locale] }}
                </span>
                <span class="max-md:text-right">
                  {{ row.values[column.id][locale] }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p
      v-if="comparison.footnoteKey"
      class="mt-8 text-xs text-primary-comfy-canvas/55"
    >
      {{ t(comparison.footnoteKey, locale) }}
    </p>

    <div v-if="comparison.primaryCta" class="mt-10 flex justify-center">
      <BrandButton
        :href="comparison.primaryCta.href"
        :target="comparison.primaryCta.target"
        variant="solid"
        size="lg"
        class="w-full p-4 text-center sm:w-auto sm:min-w-52"
      >
        {{ t(comparison.primaryCta.labelKey, locale) }}
      </BrandButton>
    </div>
  </section>
</template>
