<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Upload, X } from '@lucide/vue'
import { z } from 'astro/zod'
import { zUploadCccMediaResponse } from '@comfyorg/ingest-types/zod'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Document } from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const {
  reference,
  entityUID,
  draft,
  csrf,
  mediaRole,
  jsonOnly = false,
  fileLabel,
  accept,
  maxBytes,
  hint,
  locale = 'en'
} = defineProps<{
  reference?: Document
  entityUID?: string
  draft: number
  csrf: string
  mediaRole: string
  jsonOnly?: boolean
  fileLabel?: string
  /** Narrower allowed MIME types, e.g. the WebP-only card still. */
  accept?: string[]
  /** Narrower byte limit checked before upload. */
  maxBytes?: number
  /** Replaces the generic media help text. */
  hint?: string
  locale?: Locale
}>()
const emit = defineEmits<{
  update: [reference: Document | undefined]
  busy: [busy: boolean]
}>()
const t = translationsFor(locale).t
const state = ref<'idle' | 'uploading' | 'failed'>('idle')
const file = ref<File>()
interface UploadAttempt {
  replace: boolean
  target?: string
  draft: number
  body: FormData
  key: string
}
const attempt = shallowRef<UploadAttempt>()
const error = ref('')
function choose(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  file.value = event.target.files?.[0]
  attempt.value = undefined
  error.value = ''
}
const SUPPORTED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/json',
  ''
]
const DEFAULT_ACCEPT =
  'image/png,image/jpeg,image/webp,video/mp4,video/webm,application/json,.json,.mp4,.webm'
const workflowAPI = computed(() => mediaRole.startsWith('workflow-api-'))
const byteLimit = computed(
  () => maxBytes ?? (workflowAPI.value ? 1 << 20 : 64 << 20)
)
const inputAccept = computed(() =>
  jsonOnly ? 'application/json,.json' : (accept?.join(',') ?? DEFAULT_ACCEPT)
)
function defaultHint() {
  if (!jsonOnly) return t('cmsEditor.mediaHelp')
  return t(
    workflowAPI.value
      ? 'cccWorkflowVersions.apiFileHint'
      : 'cccWorkflowVersions.downloadFileHint'
  )
}
const helpText = computed(() => hint ?? defaultHint())
const ariaLabel = computed(
  () =>
    `${fileLabel ?? t('cmsEditor.chooseFile')} · ${t('cmsEditor.uploadNew')}`
)
function isJSONFile(file: File) {
  return (
    file.name.toLowerCase().endsWith('.json') &&
    ['application/json', ''].includes(file.type)
  )
}
function allowedType(file: File) {
  if (accept && !accept.includes(file.type)) return false
  if (jsonOnly && !isJSONFile(file)) return false
  return SUPPORTED_MIME.includes(file.type)
}
function uploadName(file: File) {
  if (file.size > byteLimit.value || !allowedType(file)) return undefined
  return file.name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '')
}
async function replacementToken(body: FormData, target: string) {
  const current = await editorRequest('item', { uid: target })
  const parsed = z
    .object({ revision_uid: z.uuid(), type: z.literal('media') })
    .safeParse(current.data)
  if (!current.ok || !parsed.success) return false
  body.set('media_uid', target)
  body.set('expected_revision_uid', parsed.data.revision_uid)
  return true
}
async function uploadAttempt(
  file: File,
  name: string,
  entity: string,
  replace: boolean,
  target?: string
) {
  const previous = attempt.value
  if (
    previous &&
    previous.replace === replace &&
    previous.target === target &&
    previous.draft === draft
  )
    return previous
  const body = new FormData()
  body.set('file', file)
  body.set('name', name)
  body.set('expected_draft_rev', String(draft))
  body.set('originating_entity_uid', entity)
  body.set('role', mediaRole)
  if (target && !(await replacementToken(body, target))) return undefined
  const next = { replace, target, draft, body, key: crypto.randomUUID() }
  attempt.value = next
  return next
}
function uploadResult(data: unknown) {
  const raw = zUploadCccMediaResponse.safeParse(data)
  if (!raw.success) return undefined
  const parsed = z
    .object({ uid: z.uuid(), revision_uid: z.uuid() })
    .safeParse(raw.data)
  return parsed.success ? parsed.data : undefined
}
function uploadFailed(status?: number) {
  state.value = 'failed'
  error.value = t(
    status === 409 ? 'cmsEditor.conflict' : 'cmsEditor.uploadFailed'
  )
}
async function upload(replace: boolean) {
  if (!entityUID || !file.value || state.value === 'uploading') return
  const name = uploadName(file.value)
  if (!name) {
    error.value = t('cmsEditor.unsupportedMedia')
    return
  }
  state.value = 'uploading'
  emit('busy', true)
  const target =
    replace && typeof reference?.id === 'string' ? reference.id : undefined
  const pending = await uploadAttempt(
    file.value,
    name,
    entityUID,
    replace,
    target
  )
  if (!pending) {
    uploadFailed()
    emit('busy', false)
    return
  }
  const response = await editorRequest('upload', {
    csrf,
    key: pending.key,
    body: pending.body
  })
  completeUpload(response, name)
  emit('busy', false)
}
function completeUpload(
  response: Awaited<ReturnType<typeof editorRequest>>,
  name: string
) {
  const parsed = uploadResult(response.data)
  if (!response.ok || !parsed) {
    uploadFailed(response.status)
    return
  }
  emit('update', {
    src: 'r2',
    id: parsed.uid,
    file_version_uid: parsed.revision_uid,
    name
  })
  file.value = undefined
  attempt.value = undefined
  state.value = 'idle'
}
</script>
<template>
  <div
    role="group"
    :aria-label="ariaLabel"
    class="grid gap-3 rounded-lg border border-admin-line bg-admin-page p-4"
  >
    <code v-if="reference?.id" class="text-xs break-all text-admin-muted"
      >{{ reference.name }} · {{ reference.id }}</code
    >
    <p v-if="!entityUID" class="text-sm text-admin-muted">
      {{ t('cmsEditor.saveBeforeUpload') }}
    </p>
    <label class="grid gap-2 text-sm text-admin-muted"
      >{{
        fileLabel ??
        t(jsonOnly ? 'cccWorkflowVersions.chooseJSON' : 'cmsEditor.chooseFile')
      }}<input
        type="file"
        :accept="inputAccept"
        :disabled="!entityUID || state === 'uploading'"
        class="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-admin-raised file:px-3 file:py-2 file:text-admin-fg"
        @change="choose"
    /></label>
    <div class="flex flex-wrap gap-2">
      <AdminButton
        :icon="Upload"
        :disabled="!file || !entityUID || state === 'uploading'"
        @click="upload(false)"
        >{{
          t(
            state === 'uploading'
              ? 'cmsEditor.uploading'
              : 'cmsEditor.uploadNew'
          )
        }}</AdminButton
      >
      <AdminButton
        v-if="reference?.id"
        :disabled="!file || state === 'uploading'"
        @click="upload(true)"
        >{{ t('cmsEditor.replaceFile') }}</AdminButton
      >
      <AdminButton
        v-if="reference?.id"
        :icon="X"
        variant="ghost"
        :disabled="state === 'uploading'"
        @click="emit('update', undefined)"
        >{{ t('cmsEditor.detach') }}</AdminButton
      >
    </div>
    <p class="text-xs text-admin-muted">
      {{ helpText }}
    </p>
    <p v-if="error" role="alert" class="text-sm text-admin-danger-text">
      {{ error }}
    </p>
  </div>
</template>
