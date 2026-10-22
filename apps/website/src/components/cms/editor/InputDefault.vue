<script setup lang="ts">
import { computed } from 'vue'
import type { SettingsBuffer } from '@/lib/cms/input-settings'
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
const { buffer, defaultIndex, inputClass, locale } = defineProps<{
  buffer: SettingsBuffer
  defaultIndex: number
  inputClass: string
  locale: Locale
}>()
const emit = defineEmits<{ change: [event: Event] }>()
const { t } = translationsFor(locale)
const value = computed(() =>
  buffer.defaultJSON === ''
    ? ''
    : defaultIndex < 0
      ? 'missing'
      : String(defaultIndex)
)
</script>
<template>
  <label class="grid gap-1 text-xs text-admin-muted"
    >{{ t('cccInputSettings.default') }}
    <select :value :class="inputClass" @change="emit('change', $event)">
      <option value="">{{ t('cccInputSettings.noDefault') }}</option>
      <option
        v-if="buffer.defaultJSON !== '' && defaultIndex < 0"
        value="missing"
        disabled
      >
        {{ buffer.defaultJSON }}
      </option>
      <option
        v-for="(row, index) in buffer.options"
        :key="row.key"
        :value="String(index)"
      >
        {{ row.label || row.text }}
      </option>
    </select>
  </label>
</template>
