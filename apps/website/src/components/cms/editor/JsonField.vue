<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Document } from '@/lib/cms/editor-document'
import { parseObject } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const {
  label,
  value,
  locale = 'en',
  disabled = false
} = defineProps<{
  label: string
  value: Document
  locale?: Locale
  disabled?: boolean
}>()
const emit = defineEmits<{
  update: [value: Document]
  validity: [valid: boolean]
}>()
const text = ref(JSON.stringify(value, null, 2))
const error = ref(false)
let lastApplied = JSON.stringify(value)
const t = translationsFor(locale).t
watch(
  () => value,
  (next) => {
    const serialized = JSON.stringify(next)
    if (!error.value && serialized !== lastApplied)
      text.value = JSON.stringify(next, null, 2)
    lastApplied = serialized
  }
)
function update() {
  if (disabled) return
  const parsed = parseObject(text.value)
  error.value = !parsed
  emit('validity', Boolean(parsed))
  if (parsed) {
    lastApplied = JSON.stringify(parsed)
    emit('update', parsed)
  }
}
</script>
<template>
  <label class="grid gap-2 text-sm text-admin-muted">
    {{ label }}
    <textarea
      v-model="text"
      rows="6"
      spellcheck="false"
      :aria-invalid="error"
      :disabled
      class="w-full rounded-lg border border-admin-field bg-admin-page p-3 font-mono text-xs text-admin-fg outline-none focus:border-primary-comfy-yellow"
      @input="update"
    />
    <span v-if="error" role="alert" class="text-admin-danger-text">{{
      t('cmsEditor.invalidJSON')
    }}</span>
  </label>
</template>
