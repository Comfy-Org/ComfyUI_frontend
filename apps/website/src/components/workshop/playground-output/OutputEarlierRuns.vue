<script setup lang="ts">
import { File as FileIcon } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { RunOutput, RunRecord } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { outputStopClass } from '@/components/workshop/playground-output/outputClasses'

export interface RunStop {
  readonly record?: RunRecord
  readonly output: RunOutput
  readonly nsfw: boolean
  readonly name: string
  readonly testId: string
}

const {
  stops,
  viewing,
  locale = 'en'
} = defineProps<{
  stops: readonly RunStop[]
  viewing?: RunRecord
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ select: [record: RunRecord | undefined] }>()
</script>

<template>
  <div
    role="group"
    :aria-label="t('workshop.output.earlier')"
    class="flex items-center gap-2 overflow-x-auto border-t border-transparency-white-t8 px-4 py-3"
    data-testid="earlier-runs"
  >
    <button
      v-for="stop in stops"
      :key="stop.testId"
      type="button"
      :aria-pressed="viewing === stop.record"
      :aria-label="stop.name"
      :class="outputStopClass(viewing === stop.record)"
      :data-testid="stop.testId"
      @click="$emit('select', stop.record)"
    >
      <video
        v-if="stop.output.kind === 'video'"
        :src="stop.output.url"
        :class="cn('size-full object-cover', stop.nsfw && 'blur-md')"
        muted
        playsinline
        preload="metadata"
      />
      <img
        v-else-if="stop.output.kind === 'image'"
        :src="stop.output.url"
        alt=""
        :class="cn('size-full object-cover', stop.nsfw && 'blur-md')"
      />
      <FileIcon
        v-else
        class="size-5 text-primary-warm-gray"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
