<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { RunOutput } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { outputLabels } from '@/lib/workshop/output-labels'
import { outputStopClass } from '@/components/workshop/playground-output/outputClasses'

const {
  files,
  shown,
  locale = 'en'
} = defineProps<{
  files: readonly RunOutput[]
  shown?: RunOutput
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ select: [index: number] }>()

const labels = computed(() =>
  outputLabels(files).map(
    ({ key, ordinal }) => `${t(key)}${ordinal ? ` ${ordinal}` : ''}`
  )
)
</script>

<template>
  <div
    role="group"
    :aria-label="t('workshop.output.files')"
    class="flex min-w-0 items-center gap-2 overflow-x-auto"
    data-testid="output-files"
  >
    <button
      v-for="(output, index) in files"
      :key="output.url"
      type="button"
      :aria-pressed="shown === output"
      :title="output.fileName"
      :class="cn(outputStopClass(shown === output), 'size-auto px-2.5 py-1')"
      @click="$emit('select', index)"
    >
      {{ labels[index] }}
    </button>
  </div>
</template>
