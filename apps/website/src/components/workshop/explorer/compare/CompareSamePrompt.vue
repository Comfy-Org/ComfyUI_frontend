<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopModel } from '@/config/models-catalogue'
import type { SamePromptSample } from '@/data/compareSamePrompt'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { SamePromptFilter } from '@/lib/workshop/explorer/same-prompt'
import {
  samePromptRows,
  samePromptTypes
} from '@/lib/workshop/explorer/same-prompt'

const {
  models,
  samples,
  locale = 'en'
} = defineProps<{
  models: readonly WorkshopModel[]
  samples: readonly SamePromptSample[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const slugs = computed(() => models.map((model) => model.slug))
const types = computed(() => samePromptTypes(samples, slugs.value))
const filter = ref<SamePromptFilter>('all')
watch(types, (offered) => {
  if (filter.value !== 'all' && !offered.includes(filter.value))
    filter.value = 'all'
})
const prompts = computed(() =>
  samePromptRows(samples, slugs.value, filter.value)
)
const filters = computed<SamePromptFilter[]>(() => ['all', ...types.value])

const cellClass = 'px-2 py-3 align-top'
const labelClass =
  'sticky left-0 z-10 bg-page py-3 pr-3 text-xs font-medium tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <tbody v-if="types.length" data-testid="compare-same-prompt">
    <tr class="border-t border-transparency-white-t8">
      <td :colspan="models.length + 1" class="pt-10 pb-4">
        <div
          class="sticky left-0 flex w-fit max-w-[calc(100vw-3rem)] flex-col gap-3"
        >
          <h3 class="text-xl font-medium text-primary-warm-white">
            {{ t('workshop.explorer.compare.samePrompt') }}
          </h3>
          <p class="text-sm text-primary-warm-gray">
            {{ t('workshop.explorer.compare.samePromptNote') }}
          </p>
          <div
            role="group"
            :aria-label="t('workshop.explorer.compare.promptTypes')"
            class="flex flex-wrap gap-2"
          >
            <button
              v-for="option in filters"
              :key="option"
              type="button"
              :aria-pressed="filter === option"
              :class="
                cn(
                  'h-8 cursor-pointer rounded-full px-3 text-xs font-medium text-primary-comfy-canvas transition-colors outline-none hover:bg-transparency-white-t4 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
                  filter === option
                    ? 'bg-transparency-white-t8 text-primary-warm-white'
                    : 'ring-1 ring-transparency-white-t8'
                )
              "
              :data-testid="`compare-prompt-type-${option}`"
              @click="filter = option"
            >
              {{ t(`workshop.explorer.compare.types.${option}`) }}
            </button>
          </div>
        </div>
      </td>
    </tr>
    <tr
      v-for="sample in prompts"
      :key="sample.prompt"
      class="border-t border-transparency-white-t8"
      data-testid="compare-prompt-row"
    >
      <th scope="row" :class="cn(labelClass, 'tracking-normal normal-case')">
        <span class="block text-2xs tracking-wider uppercase">
          {{ t('workshop.explorer.compare.prompt') }}
        </span>
        <span class="mt-1 block text-sm font-normal text-primary-comfy-canvas">
          {{ sample.prompt }}
        </span>
      </th>
      <td v-for="model in models" :key="model.slug" :class="cellClass">
        <img
          v-if="sample.images[model.slug]"
          :src="sample.images[model.slug]"
          :alt="
            t('workshop.explorer.compare.sampleAlt', {
              model: model.name,
              prompt: sample.prompt
            })
          "
          width="960"
          height="640"
          loading="lazy"
          class="aspect-3/2 w-full rounded-2xl bg-hub-surface object-cover"
        />
        <p v-else class="py-2 text-xs text-primary-warm-gray">
          {{ t('workshop.explorer.compare.noSample') }}
        </p>
      </td>
    </tr>
  </tbody>
</template>
