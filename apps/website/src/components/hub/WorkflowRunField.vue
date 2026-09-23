<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkflowField } from '../../config/workflow-fields'
import { WORKFLOW_MAX_UPLOAD_BYTES } from '../../config/workflow-fields'
import type { FileValue } from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import FileSourceInput from '../workshop/FileSourceInput.vue'

// One answer the workflow needs, asked in the words the reader understands
// rather than the name the node happens to carry, and taken through the same
// controls a model's own form uses.
const {
  field,
  name,
  disabled = false,
  locale = 'en'
} = defineProps<{
  field: WorkflowField
  /** The graph address this answer belongs to, used as the control's id. */
  name: string
  disabled?: boolean
  locale?: Locale
}>()

const value = defineModel<string | number>()
const file = defineModel<FileValue | undefined>('file')

const inputClass =
  'w-full rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-4 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-50'

const upload = computed(() =>
  field.kind === 'image' || field.kind === 'video' || field.kind === 'audio'
    ? {
        kind: 'file' as const,
        name,
        label: field.label,
        accept: [`${field.kind}/*`],
        maxBytes: WORKFLOW_MAX_UPLOAD_BYTES,
        required: true
      }
    : undefined
)
</script>

<template>
  <div class="flex flex-col gap-2" :data-testid="`field-group-${name}`">
    <div class="flex min-w-0 flex-col gap-0.5">
      <label
        :for="`field-${name}`"
        class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ field.label }}
      </label>
      <p v-if="field.help" class="text-xs text-primary-warm-gray">
        {{ field.help }}
      </p>
    </div>

    <FileSourceInput
      v-if="upload"
      v-model="file"
      :field="upload"
      :locale
      :disabled
    />

    <textarea
      v-else-if="field.kind === 'text'"
      :id="`field-${name}`"
      v-model="value"
      rows="5"
      :disabled
      :class="cn(inputClass, 'min-h-32 resize-y py-3')"
      :data-testid="`field-${name}`"
    />

    <input
      v-else
      :id="`field-${name}`"
      v-model="value"
      type="number"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :disabled
      :class="cn(inputClass, 'h-11')"
      :data-testid="`field-${name}`"
    />
  </div>
</template>
