<script setup lang="ts">
import { Search } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { UseCase } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const { useCases, locale = 'en' } = defineProps<{
  useCases: readonly UseCase[]
  locale?: Locale
}>()

const query = defineModel<string>('query', { required: true })
const useCase = defineModel<UseCase | 'all'>('useCase', { required: true })

const chipClass = (active: boolean) =>
  cn(
    'h-9 cursor-pointer rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
    active
      ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
      : 'border-transparency-white-t8 text-content-secondary hover:text-content-bright'
  )
</script>

<template>
  <div class="flex flex-col items-start gap-7">
    <label class="relative flex w-full max-w-2xl items-center">
      <span class="sr-only">{{
        t('workshop.explore.searchLabel', locale)
      }}</span>
      <Search
        class="pointer-events-none absolute left-5 size-5 text-primary-warm-gray"
        aria-hidden="true"
      />
      <input
        v-model="query"
        type="search"
        :placeholder="t('workshop.explore.searchPlaceholder', locale)"
        class="h-14 w-full rounded-full border border-transparency-white-t8 bg-hub-surface pr-6 pl-13 text-base text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="explore-search"
      />
    </label>
    <div
      class="flex flex-wrap gap-2"
      role="group"
      :aria-label="t('workshop.explore.tasks', locale)"
    >
      <button
        v-for="value in ['all', ...useCases] as const"
        :key="value"
        type="button"
        :class="chipClass(useCase === value)"
        :aria-pressed="useCase === value"
        @click="useCase = value"
      >
        {{ t(useCaseLabelKey[value], locale) }}
      </button>
    </div>
  </div>
</template>
