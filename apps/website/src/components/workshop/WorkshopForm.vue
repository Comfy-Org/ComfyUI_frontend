<script setup lang="ts">
import type {
  WorkshopDetailModel,
  WorkshopFormValues
} from '../../config/workshop-detail'
import { defaultWorkshopValues } from '../../config/workshop-detail'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopField from './WorkshopField.vue'

const { model, locale = 'en' } = defineProps<{
  model: WorkshopDetailModel
  locale?: Locale
}>()
// Defaulted, because the page renders this island with `model` alone —
// Astro's Vue shim types a component from `defineProps`, so `modelValue`
// cannot be passed from `.astro` at all. The form therefore seeds itself
// from the schema and reports the result by emitting.
const values = defineModel<WorkshopFormValues>({ default: () => ({}) })
if (Object.keys(values.value).length === 0) {
  values.value = defaultWorkshopValues(model.fields)
}
</script>

<template>
  <section
    class="rounded-2xl border border-primary-comfy-canvas/10 bg-primary-comfy-canvas/5 p-6"
  >
    <h2 class="text-xl font-semibold text-primary-comfy-canvas">
      {{ t('workshop.model.inputs', locale) }}
    </h2>
    <form class="mt-6 flex flex-col gap-6" @submit.prevent>
      <WorkshopField
        v-for="field in model.fields"
        :key="field.name"
        v-model="values"
        :field="field"
        :locale="locale"
      />
    </form>
  </section>
</template>
