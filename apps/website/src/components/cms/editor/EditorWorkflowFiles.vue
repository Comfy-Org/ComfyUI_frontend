<script setup lang="ts">
import { computed } from 'vue'
import MediaUpload from './MediaUpload.vue'
import type { Document } from '@/lib/cms/editor-document'
import { arrayObjects, objectValue } from '@/lib/cms/editor-document'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { locale, uid, draft, csrf } = defineProps<{
  locale: Locale
  uid?: string
  draft: number
  csrf: string
}>()
const document = defineModel<Document>({ required: true })
const emit = defineEmits<{ busy: [active: boolean] }>()
const t = translationsFor(locale).t
const inputClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow'
const workflowVersions = computed<Document[]>(() => {
  const versions = arrayObjects(document.value.workflow_versions)
  if (versions.length) return versions
  return arrayObjects(document.value.workflow_files).map((legacy, index) => ({
    name: typeof legacy.name === 'string' ? legacy.name : `V${index + 1}`,
    download: objectValue(legacy.file),
    api: null
  }))
})
const primaryWorkflowVersion = computed<Document>(
  () => workflowVersions.value[0] ?? { name: 'V1', api: null }
)
function setWorkflowVersionField(
  field: 'name' | 'download' | 'api',
  value: Document | string | undefined
) {
  const versions = workflowVersions.value
  const reference =
    field !== 'name' && value && typeof value === 'object'
      ? { ...value, name: `workflow-${field}-0.json` }
      : value
  const first = { ...primaryWorkflowVersion.value, [field]: reference ?? null }
  const next: Document = {
    ...document.value,
    workflow_versions: [first, ...versions.slice(1)]
  }
  delete next.workflow_files
  document.value = next
}
function workflowVersionName(event: Event) {
  if (event.target instanceof HTMLInputElement)
    setWorkflowVersionField('name', event.target.value)
}
</script>
<template>
  <section
    class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
  >
    <h2 class="text-lg">{{ t('cccWorkflowVersions.heading') }}</h2>
    <p class="text-sm text-admin-muted">
      {{ t('cccWorkflowVersions.help') }}
    </p>
    <label class="grid gap-1 text-sm text-admin-muted"
      >{{ t('cccWorkflowVersions.name')
      }}<input
        :value="primaryWorkflowVersion.name"
        :disabled="!uid"
        :class="inputClass"
        maxlength="200"
        @input="workflowVersionName"
    /></label>
    <h3 class="text-sm">{{ t('cccWorkflowVersions.download') }}</h3>
    <MediaUpload
      :reference="objectValue(primaryWorkflowVersion.download)"
      :entity-u-i-d="uid"
      :draft
      :csrf
      :locale
      media-role="workflow-download-0"
      :file-label="t('cccWorkflowVersions.download')"
      json-only
      @update="setWorkflowVersionField('download', $event)"
      @busy="emit('busy', $event)"
    />
    <h3 class="text-sm">{{ t('cccWorkflowVersions.api') }}</h3>
    <MediaUpload
      :reference="objectValue(primaryWorkflowVersion.api)"
      :entity-u-i-d="uid"
      :draft
      :csrf
      :locale
      media-role="workflow-api-0"
      :file-label="t('cccWorkflowVersions.api')"
      json-only
      @update="setWorkflowVersionField('api', $event)"
      @busy="emit('busy', $event)"
    />
  </section>
</template>
