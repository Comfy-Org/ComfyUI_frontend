<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

// The wait, as the steps it actually has, with the one it has got to lit.
const {
  steps,
  reached,
  locale = 'en'
} = defineProps<{
  steps: readonly TranslationKey[]
  reached: number
  locale?: Locale
}>()

const done = (index: number) => index <= reached
</script>

<template>
  <ol class="flex flex-col gap-2" data-testid="workflow-run-steps">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="flex items-center gap-3 text-sm"
      :class="done(index) ? 'text-content' : 'text-content-muted opacity-60'"
    >
      <span
        class="size-2 shrink-0 rounded-full"
        :class="done(index) ? 'bg-primary-comfy-yellow' : 'bg-hub-muted'"
      />
      {{ t(step, locale) }}
    </li>
  </ol>
</template>
