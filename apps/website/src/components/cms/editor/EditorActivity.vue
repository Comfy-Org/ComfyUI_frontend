<script setup lang="ts">
import { editorInputClass as inputClass } from '@/lib/cms/editor-fields'
import type { Document } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale, disabled, invalidFields } = defineProps<{
  locale: Locale
  disabled: boolean
  invalidFields: Set<string>
}>()
const document = defineModel<Document>({ required: true })
const emit = defineEmits<{ validity: [key: string, valid: boolean] }>()
const t = translationsFor(locale).t
function counterValue(name: string) {
  const raw = document.value[name]
  return typeof raw === 'number' || typeof raw === 'string' ? String(raw) : ''
}
function counter(name: string, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const raw = event.target.value
  const parsed = raw === '' ? undefined : Number(raw)
  const valid =
    parsed === undefined ||
    (/^\d+$/.test(raw) && Number.isSafeInteger(parsed) && parsed >= 0)
  const next = { ...document.value }
  if (parsed === undefined) delete next[name]
  else next[name] = valid ? parsed : raw
  document.value = next
  emit('validity', name, valid)
}
</script>
<template>
  <fieldset
    :disabled="disabled"
    class="grid gap-4 rounded-xl border border-admin-line bg-admin-card p-5"
  >
    <h2 class="text-sm font-medium">
      {{ t('cccEditorLayout.activity') }}
    </h2>
    <label
      v-for="field in ['runs', 'downloads']"
      :key="field"
      class="grid gap-1.5 text-xs text-admin-muted"
    >
      {{ t(field === 'runs' ? 'cccMetadata.runs' : 'cccMetadata.downloads') }}
      <input
        :value="counterValue(field)"
        inputmode="numeric"
        :aria-invalid="invalidFields.has(field)"
        :class="inputClass"
        @input="counter(field, $event)"
      />
      <span
        v-if="invalidFields.has(field)"
        class="text-xs text-admin-danger-text"
        >{{ t('cccMetadata.invalidCount') }}</span
      >
    </label>
  </fieldset>
</template>
