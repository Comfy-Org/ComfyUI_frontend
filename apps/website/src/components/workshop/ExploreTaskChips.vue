<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { UseCase } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'

const { useCases, locale = 'en' } = defineProps<{
  useCases: readonly UseCase[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const useCase = defineModel<UseCase | 'all'>({ required: true })

const chipClass = (active: boolean) =>
  cn(
    'h-9 cursor-pointer rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
    active
      ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
      : 'border-transparency-white-t8 text-content-secondary hover:text-content-bright'
  )
</script>

<template>
  <div
    class="flex flex-wrap gap-2"
    role="group"
    :aria-label="t('workshop.explore.tasks')"
  >
    <button
      type="button"
      :class="chipClass(useCase === 'all')"
      :aria-pressed="useCase === 'all'"
      @click="useCase = 'all'"
    >
      {{ t(useCaseLabelKey.all) }}
    </button>
    <span
      class="mx-1 h-6 w-px self-center bg-transparency-white-t20"
      aria-hidden="true"
    />
    <button
      v-for="value in useCases"
      :key="value"
      type="button"
      :class="chipClass(useCase === value)"
      :aria-pressed="useCase === value"
      @click="useCase = value"
    >
      {{ t(useCaseLabelKey[value]) }}
    </button>
  </div>
</template>
