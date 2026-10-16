<script setup lang="ts">
import type { Document } from '@/lib/cms/editor-document'
import { objectValue } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { locale } = defineProps<{ locale: Locale }>()
const document = defineModel<Document>({ required: true })
const t = translationsFor(locale).t
const inputClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow'
function scriptCode(language: string, event: Event) {
  if (!(event.target instanceof HTMLTextAreaElement)) return
  const scripts = { ...objectValue(document.value.script_code) }
  if (event.target.value.trim()) scripts[language] = event.target.value
  else delete scripts[language]
  const next = { ...document.value }
  if (Object.keys(scripts).length) next.script_code = scripts
  else delete next.script_code
  document.value = next
}
</script>
<template>
  <section
    class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
  >
    <h2 class="text-lg">{{ t('cccMetadata.scriptCode') }}</h2>
    <p class="text-sm text-admin-muted">
      {{ t('cccMetadata.scriptHint') }}
    </p>
    <label
      v-for="language in ['python', 'typescript', 'curl'] as const"
      :key="language"
      class="grid gap-2 text-sm text-admin-muted"
    >
      {{ t(`cccMetadata.script.${language}`) }}
      <textarea
        :value="
          typeof objectValue(document.script_code)[language] === 'string'
            ? String(objectValue(document.script_code)[language])
            : ''
        "
        rows="8"
        maxlength="60000"
        spellcheck="false"
        :class="inputClass"
        @input="scriptCode(language, $event)"
      />
    </label>
  </section>
</template>
