<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'
import { computed } from 'vue'

import { Component as ComponentIcon } from '@lucide/vue'

import { t } from '../../i18n/translations'

const {
  locale = 'en',
  estimateKey,
  estimateCount
} = defineProps<{
  credits: string
  label: string
  estimateKey?: TranslationKey
  estimateCount?: string
  locale?: Locale
}>()

const estimate = computed(() => {
  if (!estimateKey) return undefined
  const text = t(estimateKey, locale)
  return estimateCount ? text.replace('{count}', estimateCount) : text
})
</script>

<template>
  <div class="mt-6">
    <div class="flex items-center gap-2">
      <ComponentIcon class="text-primary-comfy-orange size-4 shrink-0" />
      <span class="text-primary-warm-white ppformula-text-center text-sm">
        <span class="font-extrabold">
          {{ credits }}
        </span>
        {{ label }}
      </span>
    </div>
    <p v-if="estimate" class="text-primary-warm-gray mt-1.5 text-xs">
      {{ estimate }}
    </p>
  </div>
</template>
