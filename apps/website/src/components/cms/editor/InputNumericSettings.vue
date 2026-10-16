<script setup lang="ts">
import { numericSettings } from '@/lib/cms/input-settings'
import type { SettingsBuffer, NumericSetting } from '@/lib/cms/input-settings'
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
const { buffer, inputClass, locale, disabled } = defineProps<{
  disabled: boolean
  buffer: SettingsBuffer
  inputClass: string
  locale: Locale
}>()
const emit = defineEmits<{ input: [key: NumericSetting, event: Event] }>()
const { t } = translationsFor(locale)
</script>
<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <label
      v-for="key in numericSettings"
      :key
      class="grid gap-1 text-xs text-admin-muted"
    >
      {{ t(`cccInputSettings.${key}`) }}
      <input
        :disabled
        :value="buffer.numeric[key]"
        type="text"
        inputmode="decimal"
        :class="inputClass"
        @input="emit('input', key, $event)"
      />
    </label>
  </div>
</template>
