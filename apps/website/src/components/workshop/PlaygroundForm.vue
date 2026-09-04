<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import type {
  FieldErrors,
  FieldSchema,
  FormValues
} from '../../config/workshop-playground'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PlaygroundField from './PlaygroundField.vue'

const {
  schema,
  errors,
  locale = 'en',
  disabled = false
} = defineProps<{
  schema: readonly FieldSchema[]
  errors: FieldErrors
  locale?: Locale
  disabled?: boolean
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
</script>

<template>
  <div class="flex flex-col gap-8" data-testid="playground-form">
    <PlaygroundField
      v-for="field in groups.primary"
      :key="field.name"
      v-model="values"
      :field
      :errors
      :locale
      :disabled
    />

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
