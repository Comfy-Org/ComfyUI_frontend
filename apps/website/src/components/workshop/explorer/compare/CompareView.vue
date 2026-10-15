<script setup lang="ts">
import { computed, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { SamePromptSample } from '@/data/compareSamePrompt'
import { SAME_PROMPT_SAMPLES } from '@/data/compareSamePrompt'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { compareRows } from '@/lib/workshop/explorer/compare'
import CompareColumnCard from './CompareColumnCard.vue'
import CompareSamePrompt from './CompareSamePrompt.vue'
import CompareToolbar from './CompareToolbar.vue'

const {
  models,
  toolbar = false,
  removable = false,
  samples = SAME_PROMPT_SAMPLES,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  /** The catalogue's own view: a title, Add model and Copy link. */
  toolbar?: boolean
  /** Whether each column can be taken out of the comparison. */
  removable?: boolean
  samples?: readonly SamePromptSample[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ remove: [slug: string]; add: [] }>()

const titleId = `compare-view-${useId()}`
const rows = computed(() => compareRows(models, locale))

const cellClass = 'px-2 py-3 align-top'
const labelClass =
  'sticky left-0 z-10 bg-page py-3 pr-3 text-xs font-medium tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <section
    :aria-labelledby="toolbar ? titleId : undefined"
    data-testid="compare-view"
  >
    <CompareToolbar
      v-if="toolbar"
      :count="models.length"
      :title-id
      :locale
      @add="emit('add')"
    />

    <div class="-mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0">
      <table
        class="w-full table-fixed border-collapse text-left text-sm"
        :style="{ minWidth: `${7 + models.length * 14}rem` }"
      >
        <colgroup>
          <col class="w-28 sm:w-40" />
          <col v-for="model in models" :key="model.slug" />
        </colgroup>
        <thead>
          <tr>
            <td class="sticky left-0 z-10 bg-page" />
            <th
              v-for="model in models"
              :key="model.slug"
              scope="col"
              :class="cn(cellClass, 'pt-0 font-normal')"
              :aria-label="model.name"
              data-testid="compare-column"
            >
              <CompareColumnCard
                :model
                :removable
                :locale
                @remove="emit('remove', model.slug)"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.key"
            class="border-t border-transparency-white-t8"
            :data-testid="`compare-row-${row.key}`"
          >
            <th scope="row" :class="labelClass">{{ t(row.label) }}</th>
            <td
              v-for="(value, index) in row.values"
              :key="models[index].slug"
              :class="cn(cellClass, 'text-primary-comfy-canvas')"
            >
              {{ value }}
            </td>
          </tr>
        </tbody>
        <CompareSamePrompt :models :samples :locale />
      </table>
    </div>
  </section>
</template>
