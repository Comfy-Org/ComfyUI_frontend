<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { useFrameRatioMismatch } from '../../composables/useFrameRatioMismatch'
import type { FrameRatioRule } from '../../config/workshop-model-restrictions'
import { frameSource } from '../../config/workshop-model-restrictions'
import type {
  FieldErrors,
  FieldSchema,
  FormValues
} from '../../config/workshop-playground'
import { groupPlaygroundFields } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FrameRatioNotice from './FrameRatioNotice.vue'
import PlaygroundField from './PlaygroundField.vue'

const {
  schema,
  errors,
  frameRatio,
  locale = 'en',
  disabled = false,
  fileUploadsDisabled = false
} = defineProps<{
  schema: readonly FieldSchema[]
  errors: FieldErrors
  frameRatio?: FrameRatioRule
  locale?: Locale
  disabled?: boolean
  fileUploadsDisabled?: boolean
}>()

const values = defineModel<FormValues>({ required: true })

// The packed display overlay records which model-specific knobs belong under
// Advanced. A legacy positional fallback lives in the helper for workflow
// fixtures that do not carry that metadata yet.
const groups = computed(() => groupPlaygroundFields(schema))

// The frames are ordinary fields, so the pair is read off the values their own
// controls already write rather than given state of its own.
const frames = computed(() =>
  frameRatio
    ? {
        first: frameSource(values.value[frameRatio.first]),
        last: frameSource(values.value[frameRatio.last])
      }
    : undefined
)

const FRAME_RATIO_NOTICE_ID = 'frame-ratio-notice'
const frameRatioMismatch = useFrameRatioMismatch(
  () => frames.value?.first,
  () => frames.value?.last
)

// The last frame is the one that gets stretched, so it is the one marked.
function attentionFor(name: string): string | undefined {
  return frameRatioMismatch.value && name === frameRatio?.last
    ? FRAME_RATIO_NOTICE_ID
    : undefined
}
const advancedHasErrors = computed(() =>
  groups.value.advanced.some((field) => errors[field.name] !== undefined)
)
const advancedOpen = ref(false)
watch(
  advancedHasErrors,
  (hasErrors) => {
    if (hasErrors) advancedOpen.value = true
  },
  { immediate: true }
)

function onAdvancedToggle(event: Event) {
  if (event.target instanceof HTMLDetailsElement)
    advancedOpen.value = event.target.open
}
</script>

<template>
  <div class="flex flex-col gap-8" data-testid="playground-form">
    <div
      v-if="groups.primary.length"
      class="flex flex-col gap-8"
      data-testid="playground-inputs"
    >
      <PlaygroundField
        v-for="field in groups.primary"
        :key="field.name"
        v-model="values"
        :field
        :errors
        :attention="attentionFor(field.name)"
        :locale
        :disabled
        :file-uploads-disabled
      />
      <FrameRatioNotice
        v-if="frameRatioMismatch"
        :id="FRAME_RATIO_NOTICE_ID"
        :locale
      />
    </div>

    <div
      v-if="groups.settings.length"
      class="flex flex-col gap-8"
      data-testid="playground-settings"
    >
      <PlaygroundField
        v-for="field in groups.settings"
        :key="field.name"
        v-model="values"
        :field
        :errors
        :locale
        :disabled
        :file-uploads-disabled
      />
    </div>

    <details
      v-if="groups.advanced.length"
      class="group rounded-2xl border border-transparency-white-t8"
      data-testid="playground-advanced"
      :open="advancedOpen"
      @toggle="onAdvancedToggle"
    >
      <summary
        class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase select-none hover:text-primary-warm-white [&::-webkit-details-marker]:hidden"
      >
        {{ t('workshop.form.advanced', locale) }}
        <ChevronDown
          class="size-4 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div class="flex flex-col gap-5 px-4 pb-4">
        <PlaygroundField
          v-for="field in groups.advanced"
          :key="field.name"
          v-model="values"
          :field
          :errors
          :locale
          :disabled
          :file-uploads-disabled
        />
      </div>
    </details>
  </div>
</template>
