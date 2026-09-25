<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { EditingCopyKey } from '../../../lib/workshop/cinematic-studio/editing-copy'
import {
  cinematicRelightDirections,
  cinematicRelightTypes
} from '../../../lib/workshop/cinematic-studio/editing'
const { locale, fieldClass } = defineProps<{
  locale: Locale
  fieldClass: string
}>()
const lightType = defineModel<string>('lightType', { required: true })
const lightDirection = defineModel<string>('lightDirection', { required: true })
const emit = defineEmits<{ change: [] }>()
const t = (key: EditingCopyKey) => tcEditing(key, locale)
</script>
<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <label class="flex flex-col gap-2 text-sm"
      >{{ t('type')
      }}<select
        v-model="lightType"
        :class="fieldClass"
        @change="emit('change')"
      >
        <option
          v-for="option in cinematicRelightTypes"
          :key="option.id"
          :value="option.id"
        >
          {{ t(option.id) }}
        </option>
      </select></label
    >
    <label class="flex flex-col gap-2 text-sm"
      >{{ t('direction')
      }}<select
        v-model="lightDirection"
        :class="fieldClass"
        @change="emit('change')"
      >
        <option
          v-for="option in cinematicRelightDirections"
          :key="option.id"
          :value="option.id"
        >
          {{ t(option.id) }}
        </option>
      </select></label
    >
  </div>
  <p class="text-xs/relaxed text-primary-comfy-canvas">
    {{ t('relightNote') }}
  </p>
</template>
