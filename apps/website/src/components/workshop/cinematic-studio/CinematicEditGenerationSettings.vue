<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { EditingCopyKey } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
const { selectedModel, validSeed, fieldClass, locale } = defineProps<{
  selectedModel?: CinematicModel
  validSeed: boolean
  fieldClass: string
  locale: Locale
}>()
const variations = defineModel<number>('variations', { required: true })
const seedInput = defineModel<string | number>('seedInput', { required: true })
const t = (key: EditingCopyKey) => tcEditing(key, locale)
</script>
<template>
  <label class="flex flex-col gap-2 text-sm"
    >{{ t('variations') }}
    <select v-model.number="variations" :class="fieldClass">
      <option v-for="count in [1, 2, 3, 4]" :key="count" :value="count">
        {{ count }}
      </option>
    </select>
  </label>
  <p class="text-xs/relaxed text-primary-comfy-canvas">
    {{ t('variationsNote') }}
  </p>
  <label v-if="selectedModel?.seed" class="flex flex-col gap-2 text-sm"
    >{{ t('seed') }}
    <input
      v-model="seedInput"
      :aria-label="t('seed')"
      type="number"
      :min="selectedModel.seed.minimum"
      :max="selectedModel.seed.maximum"
      :step="selectedModel.seed.step"
      :class="fieldClass"
    />
    <span class="text-xs text-primary-comfy-canvas">{{ t('seedNote') }}</span>
  </label>
  <p v-if="!validSeed" role="alert" class="text-sm">
    {{ t('invalidSeed') }}
  </p>
</template>
