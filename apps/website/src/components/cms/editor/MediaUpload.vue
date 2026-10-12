<script setup lang="ts">
import { ref, shallowRef } from 'vue'
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
  locale = 'en'
} = defineProps<{
  reference?: Document
  entityUID?: string
  draft: number
  csrf: string
  mediaRole: string
  locale?: Locale
}>()
const emit = defineEmits<{
  update: [reference: Document | undefined]
  busy: [busy: boolean]
}>()
const t = translationsFor(locale).t
const state = ref<'idle' | 'uploading' | 'failed'>('idle')
const file = ref<File>()
const attempt = shallowRef<{
  replace: boolean
  target?: string
  draft: number
  body: FormData
  key: string
}>()
const error = ref('')
function choose(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  file.value = event.target.files?.[0]
  attempt.value = undefined
  error.value = ''
}
async function upload(replace: boolean) {
  if (!entityUID || !file.value || state.value === 'uploading') return
  const mime = file.value.type
  if (
    file.value.size > 8 << 20 ||
    !['image/png', 'image/jpeg', 'image/webp', 'application/json', ''].includes(
      mime
    )
  ) {
    error.value = t('cmsEditor.unsupportedMedia')
    return
  }
  const name = file.value.name
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/^\.+/, '')
  if (!name) {
    error.value = t('cmsEditor.unsupportedMedia')
    return
  }
  state.value = 'uploading'
  emit('busy', true)
  const target =
    replace && typeof reference?.id === 'string' ? reference.id : undefined
  if (
    !attempt.value ||
    attempt.value.replace !== replace ||
    attempt.value.target !== target ||
    attempt.value.draft !== draft
  ) {
    const body = new FormData()
    body.set('file', file.value)
    body.set('name', name)
    body.set('expected_draft_rev', String(draft))
    body.set('originating_entity_uid', entityUID)
    body.set('role', mediaRole)
    if (target) {
      // The current Media edit token may differ from the retained exact pin.
      const current = await editorRequest('item', { uid: target })
      const parsed = z
        .object({ revision_uid: z.uuid(), type: z.literal('media') })
        .safeParse(current.data)
      if (!current.ok || !parsed.success) {
        state.value = 'failed'
        error.value = t('cmsEditor.uploadFailed')
        emit('busy', false)
        return
      }
      body.set('media_uid', target)
      body.set('expected_revision_uid', parsed.data.revision_uid)
    }
    attempt.value = { replace, target, draft, body, key: crypto.randomUUID() }
  }
  // Retry the exact bytes/token/key after an uncertain response. Re-fetching the
  // head here could turn a successful replacement retry into a second edit.
  const response = await editorRequest('upload', {
    csrf,
    key: attempt.value.key,
    body: attempt.value.body
  })
  const raw = zUploadCccMediaResponse.safeParse(response.data)
  const parsed = raw.success
    ? z.object({ uid: z.uuid(), revision_uid: z.uuid() }).safeParse(raw.data)
    : undefined
  if (!response.ok || !parsed?.success) {
    state.value = 'failed'
    error.value = t(
      response.status === 409 ? 'cmsEditor.conflict' : 'cmsEditor.uploadFailed'
    )
  } else {
    emit('update', {
      src: 'r2',
      id: parsed.data.uid,
      file_version_uid: parsed.data.revision_uid,
      name
    })
    file.value = undefined
    attempt.value = undefined
    state.value = 'idle'
  }
  emit('busy', false)
}
</script>
<template>
  <div class="grid gap-3 rounded-lg border border-admin-line bg-admin-page p-4">
    <code v-if="reference?.id" class="break-all text-xs text-admin-muted"
      >{{ reference.name }} · {{ reference.id }}</code
    >
    <p v-if="!entityUID" class="text-sm text-admin-muted">
      {{ t('cmsEditor.saveBeforeUpload') }}
    </p>
    <label class="grid gap-2 text-sm text-admin-muted"
      >{{ t('cmsEditor.chooseFile')
      }}<input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/json,.json"
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
    <p class="text-xs text-admin-muted">{{ t('cmsEditor.mediaHelp') }}</p>
    <p v-if="error" role="alert" class="text-sm text-admin-danger-text">
      {{ error }}
    </p>
  </div>
</template>
