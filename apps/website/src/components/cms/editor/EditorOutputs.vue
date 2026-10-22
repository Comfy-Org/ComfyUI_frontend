<script setup lang="ts">
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Document } from '@/lib/cms/editor-document'
import { arrayObjects } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { locale, invalid } = defineProps<{ locale: Locale; invalid: boolean }>()
const document = defineModel<Document>({ required: true })
const emit = defineEmits<{ validity: [valid: boolean] }>()
const t = translationsFor(locale).t
const inputClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow'
function updateOutputs(next: Document) {
  document.value = next
  const seen = new Set<string>()
  emit(
    'validity',
    arrayObjects(next.outputs).every((entry) => {
      const id = typeof entry.id === 'string' ? entry.id.trim() : ''
      if (
        !id ||
        seen.has(id) ||
        typeof entry.nodeId !== 'string' ||
        !entry.nodeId.trim() ||
        typeof entry.key !== 'string' ||
        !entry.key.trim()
      )
        return false
      seen.add(id)
      return true
    })
  )
}
function output(index: number, name: string, event: Event) {
  if (
    !(
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement
    )
  )
    return
  const value = event.target.value
  updateOutputs({
    ...document.value,
    outputs: arrayObjects(document.value.outputs).map((item, at) =>
      at === index ? { ...item, [name]: value } : item
    )
  })
}
function addOutput() {
  updateOutputs({
    ...document.value,
    outputs: [
      ...arrayObjects(document.value.outputs),
      { id: '', nodeId: '', key: '', kind: 'image' }
    ]
  })
}
function removeOutput(index: number) {
  updateOutputs({
    ...document.value,
    outputs: arrayObjects(document.value.outputs).filter(
      (_, at) => at !== index
    )
  })
}
</script>
<template>
  <section
    class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-medium">{{ t('cccMetadata.outputs') }}</h2>
      <AdminButton @click="addOutput">{{
        t('cccMetadata.addOutput')
      }}</AdminButton>
    </div>
    <p v-if="invalid" class="text-sm text-admin-danger-text">
      {{ t('cccMetadata.invalidOutputs') }}
    </p>
    <div
      v-for="(entry, index) in arrayObjects(document.outputs)"
      :key="index"
      class="grid gap-3 rounded-lg border border-admin-line p-4 sm:grid-cols-2"
    >
      <label
        v-for="field in ['id', 'nodeId', 'key'] as const"
        :key="field"
        class="grid gap-1 text-sm text-admin-muted"
        >{{ t(`cccMetadata.output.${field}`, { count: index + 1 })
        }}<input
          :value="typeof entry[field] === 'string' ? entry[field] : ''"
          :class="inputClass"
          maxlength="200"
          @input="output(index, field, $event)"
      /></label>
      <label class="grid gap-1 text-sm text-admin-muted"
        >{{ t('cccMetadata.output.kind', { count: index + 1 })
        }}<select
          :value="entry.kind"
          :class="inputClass"
          @change="output(index, 'kind', $event)"
        >
          <option
            v-for="kind in ['image', 'video', 'audio', '3d', 'text'] as const"
            :key="kind"
            :value="kind"
          >
            {{ t(`cccWorkflow.output.${kind}`) }}
          </option>
        </select></label
      >
      <AdminButton @click="removeOutput(index)">{{
        t('cccMetadata.removeOutput')
      }}</AdminButton>
    </div>
  </section>
</template>
