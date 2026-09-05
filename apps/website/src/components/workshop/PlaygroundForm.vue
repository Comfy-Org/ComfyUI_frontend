<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  FieldErrors,
  FieldSchema,
  FormValues
} from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PlaygroundField from './PlaygroundField.vue'
import StepHeading from './StepHeading.vue'

const {
  schema,
  errors,
  locale = 'en',
  disabled = false,
  stepped = false
} = defineProps<{
  schema: readonly FieldSchema[]
  errors: FieldErrors
  locale?: Locale
  disabled?: boolean
  /** Draws the groups the form already computes as numbered steps. The names
   * come from what each group holds, so they hold for any schema. */
  stepped?: boolean
}>()

const values = defineModel<FormValues>({ required: true })

// Prompts and uploads stay on top; the remaining knobs pair up, toggles fold
// away. The catalogue lists each release as its own model, so the node's own
// model picker would be a second, contradictory way to choose one: it is drawn
// only where hiding it would leave the visitor an empty panel.
const groups = computed(() => {
  const withoutPicker = schema.filter((field) => field.name !== 'model')
  const shown = withoutPicker.length > 0 ? withoutPicker : schema
  const lastPrimary = shown.reduce(
    (last, field, index) =>
      field.kind === 'text' || field.kind === 'file' ? index : last,
    -1
  )
  const rest = shown.slice(lastPrimary + 1)
  return {
    primary: shown.slice(0, lastPrimary + 1),
    settings: rest.filter((field) => field.kind !== 'toggle'),
    advanced: rest.filter((field) => field.kind === 'toggle')
  }
})

const stepClass =
  'rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-5'
</script>

<template>
  <div class="flex flex-col gap-8" data-testid="playground-form">
    <div
      v-if="groups.primary.length"
      :class="cn('flex flex-col gap-8', stepped && stepClass)"
      data-testid="playground-inputs"
    >
      <StepHeading
        v-if="stepped"
        :step="1"
        :title="t('workshop.form.step.inputs', locale)"
        :note="t('workshop.form.step.inputsNote', locale)"
      />
      <PlaygroundField
        v-for="field in groups.primary"
        :key="field.name"
        v-model="values"
        :field
        :errors
        :locale
        :disabled
      />
    </div>

    <div
      v-if="groups.settings.length"
      :class="cn('flex flex-col gap-8', stepped && stepClass)"
      data-testid="playground-settings"
    >
      <StepHeading
        v-if="stepped"
        :step="groups.primary.length ? 2 : 1"
        :title="t('workshop.form.step.output', locale)"
        :note="t('workshop.form.step.outputNote', locale)"
      />
      <PlaygroundField
        v-for="field in groups.settings"
        :key="field.name"
        v-model="values"
        :field
        :errors
        :locale
        :disabled
      />
    </div>

    <details
      v-if="groups.advanced.length"
      class="group rounded-2xl border border-transparency-white-t8"
      data-testid="playground-advanced"
    >
      <summary
        class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold tracking-wider text-primary-warm-gray uppercase select-none hover:text-primary-warm-white [&::-webkit-details-marker]:hidden"
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
        />
      </div>
    </details>
  </div>
</template>
