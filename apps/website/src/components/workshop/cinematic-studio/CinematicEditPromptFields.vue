<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tcEditing } from '../../../lib/workshop/cinematic-studio/editing-copy'
import type { EditingCopyKey } from '../../../lib/workshop/cinematic-studio/editing-copy'
import CinematicRelightEditControls from './CinematicRelightEditControls.vue'
const { operation, emptyLook, locale, fieldClass } = defineProps<{
  operation: 'edit' | 'camera' | 'look' | 'relight'
  emptyLook: boolean
  locale: Locale
  fieldClass: string
}>()
const instruction = defineModel<string>('instruction', { required: true })
const additional = defineModel<string>('additional', { required: true })
const lightType = defineModel<string>('lightType', { required: true })
const lightDirection = defineModel<string>('lightDirection', { required: true })
const emit = defineEmits<{ change: [] }>()
const t = (key: EditingCopyKey) => tcEditing(key, locale)
</script>
<template>
  <p
    v-if="operation === 'look'"
    class="text-xs/relaxed text-primary-comfy-canvas"
  >
    {{ t(emptyLook ? 'emptyLook' : 'lookNote') }}
  </p>
  <CinematicRelightEditControls
    v-if="operation === 'relight'"
    v-model:light-type="lightType"
    v-model:light-direction="lightDirection"
    :locale
    :field-class
    @change="emit('change')"
  />
  <label class="flex flex-col gap-2 text-sm"
    >{{ t('instruction')
    }}<textarea
      v-model="instruction"
      :class="fieldClass"
      rows="6"
      maxlength="8000"
      :placeholder="t('placeholder')"
    />
  </label>
  <label v-if="operation !== 'edit'" class="flex flex-col gap-2 text-sm"
    >{{ t('extra')
    }}<textarea
      v-model="additional"
      :class="fieldClass"
      rows="2"
      maxlength="1500"
    />
  </label>
</template>
