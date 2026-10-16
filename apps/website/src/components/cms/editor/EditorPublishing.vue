<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Document } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  document,
  disabled = false,
  locale = 'en'
} = defineProps<{
  document: Document
  disabled?: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ update: [document: Document] }>()
const { t } = translationsFor(locale)
const id = useId()
const fieldClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow disabled:opacity-50'
const scheduled = computed(() => {
  const raw = document.visible_from
  if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) return ''
  // The control is explicitly UTC, independent of the editor's machine timezone.
  return new Date(raw).toISOString().slice(0, 19)
})
function change(field: string, value: Document[string] | undefined) {
  if (disabled) return
  const next = { ...document }
  if (value === undefined) delete next[field]
  else next[field] = value
  emit('update', next)
}
function enabled(event: Event) {
  if (event.target instanceof HTMLInputElement)
    change('enabled', event.target.checked)
}
function audience(event: Event) {
  if (event.target instanceof HTMLSelectElement)
    change('visibility', event.target.value)
}
function schedule(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  if (!event.target.value) return change('visible_from', undefined)
  const value = new Date(`${event.target.value}Z`)
  if (Number.isFinite(value.getTime()))
    change('visible_from', value.toISOString())
}
</script>

<template>
  <section
    class="grid gap-4 rounded-xl border border-admin-line bg-admin-card p-5"
  >
    <h2 class="text-sm font-medium">{{ t('cccEditorLayout.publishing') }}</h2>
    <label class="flex items-center justify-between gap-3 text-sm">
      {{ t('cmsEditor.enabled') }}
      <input
        type="checkbox"
        :checked="document.enabled === true"
        :disabled
        class="size-4 accent-primary-comfy-yellow"
        @change="enabled"
      />
    </label>
    <label class="grid gap-1.5 text-xs text-admin-muted">
      {{ t('cmsEditor.visibility') }}
      <select
        :value="document.visibility"
        :disabled
        :class="fieldClass"
        @change="audience"
      >
        <option value="staff">{{ t('cmsEditor.staff') }}</option>
        <option value="public">{{ t('cmsEditor.public') }}</option>
      </select>
    </label>
    <label class="grid gap-1.5 text-xs text-admin-muted">
      {{ t('cmsEditor.visibleFrom') }}
      <input
        type="datetime-local"
        step="1"
        :value="scheduled"
        :disabled
        :aria-describedby="`${id}-help`"
        :class="fieldClass"
        @change="schedule"
      />
    </label>
    <p :id="`${id}-help`" class="text-xs text-admin-muted">
      {{ t('cccEditorLayout.utc') }}
    </p>
  </section>
</template>
