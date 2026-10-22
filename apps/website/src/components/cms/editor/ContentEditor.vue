<script setup lang="ts">
import EditorStatus from './EditorStatus.vue'
import { computed, onMounted, ref, toRaw } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ArrowLeft, Save } from '@lucide/vue'
import { z } from 'astro/zod'
import {
  zCreateCccItemResponse,
  zDeleteCccItemResponse
} from '@comfyorg/ingest-types/zod'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import EditorDeletion from './EditorDeletion.vue'
import EditorQuestions from './EditorQuestions.vue'
import EditorOutputs from './EditorOutputs.vue'
import EditorScripts from './EditorScripts.vue'
import EditorWorkflowFiles from './EditorWorkflowFiles.vue'
import EditorContentFields from './EditorContentFields.vue'
import { useEditorFields } from '@/lib/cms/editor-fields'
import EditorSaveBar from './EditorSaveBar.vue'
import EditorPublishing from './EditorPublishing.vue'
import InputsEditor from './InputsEditor.vue'
import ExamplesEditor from './ExamplesEditor.vue'
import JsonField from './JsonField.vue'
import EditorHero from './EditorHero.vue'
import EditorActivity from './EditorActivity.vue'
import type {
  ContentType,
  Document,
  EditorSnapshot
} from '@/lib/cms/editor-document'
import {
  arrayObjects,
  editorSnapshot,
  hasReservedFields,
  jsonObject,
  objectValue,
  savePayload
} from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'
import { changeID } from '@/lib/cms/change-id'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  initial,
  snapshot: initialSnapshot,
  type: initialType,
  draft: initialDraft,
  csrf,
  sidebar = false,
  locale = 'en'
} = defineProps<{
  initial: Document
  snapshot?: EditorSnapshot
  type: ContentType
  draft: number
  csrf: string
  sidebar?: boolean
  locale?: Locale
}>()
const t = translationsFor(locale).t
const document = ref<Document>(structuredClone(toRaw(initial)))
const validChangeID = computed(
  () => changeID.safeParse(document.value.change_id).success
)
const snapshot = ref(initialSnapshot)
const kind = ref<ContentType>(initialType)
const inputsEnabled = computed(
  () =>
    kind.value !== 'workflow' ||
    (typeof document.value.runnable === 'boolean'
      ? document.value.runnable
      : Object.keys(objectValue(document.value.inputs)).length > 0)
)
const draft = ref(initialDraft)
const state = ref<'idle' | 'saving' | 'saved' | 'conflict' | 'failed'>('idle')
const errors = ref<string[]>([])
const invalidFields = ref(new Set<string>())
const uploads = ref(0)
const attempt = ref<{
  payload: string
  operation: 'save' | 'delete'
  key: string
}>()
const deleting = ref(false)
const ready = ref(false)
const editorEpoch = ref(0)
onMounted(() => {
  ready.value = true
})
const blocked = computed(
  () =>
    state.value === 'saving' ||
    uploads.value > 0 ||
    !validChangeID.value ||
    invalidFields.value.size > 0 ||
    (Array.isArray(document.value.workflow_versions) &&
      arrayObjects(document.value.workflow_versions).some(
        (version) =>
          !objectValue(version.download).id ||
          !String(version.name ?? '').trim()
      ))
)
const completeDocumentBlocked = computed(
  () =>
    snapshot.value?.is_deleted ||
    state.value === 'saving' ||
    uploads.value > 0 ||
    [...invalidFields.value].some((key) => key !== 'document')
)
function replaceDocument(next: Document) {
  if (!completeDocumentBlocked.value) document.value = next
}
const dirty = computed(
  () =>
    JSON.stringify(document.value) !==
    JSON.stringify(snapshot.value?.document ?? initial)
)
const unsaved = computed(
  () =>
    dirty.value ||
    invalidFields.value.size > 0 ||
    kind.value !== (snapshot.value?.type ?? initialType)
)
const readOnly = computed(
  () =>
    state.value === 'saving' ||
    uploads.value > 0 ||
    invalidFields.value.has('document') ||
    snapshot.value?.is_deleted === true
)
const saveBlocked = computed(
  () => blocked.value || snapshot.value?.is_deleted === true
)
useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (unsaved.value && state.value !== 'saving') event.preventDefault()
})
function discardUnsaved() {
  if (state.value === 'saving' || uploads.value > 0) return
  document.value = structuredClone(toRaw(snapshot.value?.document ?? initial))
  kind.value = snapshot.value?.type ?? initialType
  invalidFields.value = new Set()
  errors.value = []
  state.value = 'idle'
  attempt.value = undefined
  editorEpoch.value++
}
const { value, patch } = useEditorFields(document, () => {
  state.value = 'idle'
})
function validity(key: string, valid: boolean) {
  const next = new Set(invalidFields.value)
  if (valid) next.delete(key)
  else next.add(key)
  invalidFields.value = next
}
function busy(active: boolean) {
  uploads.value = Math.max(0, uploads.value + (active ? 1 : -1))
}
type SaveAction = 'save' | 'delete' | 'undelete'
function canSave(action: SaveAction) {
  if (blocked.value) return false
  if (action === 'delete')
    return (
      Boolean(snapshot.value) && !snapshot.value?.is_deleted && !unsaved.value
    )
  if (action === 'undelete') return snapshot.value?.is_deleted === true
  return !snapshot.value?.is_deleted
}
function mutationBody(action: SaveAction) {
  if (action === 'delete' && snapshot.value)
    return {
      uid: snapshot.value.uid,
      expected_draft_rev: draft.value,
      expected_revision_uid: snapshot.value.revision_uid
    }
  return {
    ...savePayload(document.value, kind.value, draft.value, snapshot.value),
    ...(snapshot.value ? { uid: snapshot.value.uid } : {})
  }
}
function reportSaveFailure(
  response: Awaited<ReturnType<typeof editorRequest>>
) {
  state.value = response.status === 409 ? 'conflict' : 'failed'
  const details = z
    .object({
      field_errors: z.array(z.object({ path: z.string(), message: z.string() }))
    })
    .safeParse(response.data)
  if (details.success) {
    errors.value = details.data.field_errors.map(
      (field) => `${field.path}: ${field.message}`
    )
    return
  }
  const message =
    response.status === 409
      ? 'cmsEditor.conflict'
      : response.status === 403
        ? 'cmsEditor.permissionDenied'
        : 'cmsEditor.saveFailed'
  errors.value = [t(message)]
}
function savedSnapshot(data: unknown, action: SaveAction) {
  const flat =
    action === 'delete'
      ? zDeleteCccItemResponse.safeParse(data)
      : zCreateCccItemResponse.safeParse(data)
  const preserved = jsonObject.safeParse(data)
  if (!flat.success || !preserved.success) return
  const next = editorSnapshot({
    ...preserved.data,
    expected_draft_rev: draft.value,
    expected_revision_uid: flat.data.revision_uid
  })
  if (!next || next.is_deleted !== (action === 'delete')) return
  if (snapshot.value && next.uid !== snapshot.value.uid) return
  return next
}
async function save(action: SaveAction = 'save') {
  if (!canSave(action)) return
  if (hasReservedFields(document.value)) {
    state.value = 'failed'
    errors.value = [t('cmsEditor.reservedFields')]
    return
  }
  const operation = action === 'delete' ? 'delete' : 'save'
  const payload = JSON.stringify(mutationBody(action))
  prepareAttempt(payload, operation)
  state.value = 'saving'
  errors.value = []
  const response = await editorRequest(operation, {
    csrf,
    key: attempt.value?.key,
    body: payload
  })
  deleting.value = false
  if (!response.ok) {
    reportSaveFailure(response)
    return
  }
  const next = savedSnapshot(response.data, action)
  if (!next) {
    state.value = 'failed'
    errors.value = [t('cmsEditor.invalidResponse')]
    return
  }
  snapshot.value = next
  document.value = structuredClone(next.document)
  state.value = 'saved'
  attempt.value = undefined
  editorEpoch.value++
  window.history.replaceState(null, '', `/admin/content/${next.uid}/edit`)
}
function prepareAttempt(payload: string, operation: 'save' | 'delete') {
  if (
    attempt.value?.payload !== payload ||
    attempt.value.operation !== operation
  )
    attempt.value = { payload, operation, key: crypto.randomUUID() }
}
</script>
<template>
  <form
    :data-editor-ready="ready"
    class="grid gap-5 pb-24 font-admin text-admin-fg"
    @submit.prevent="save()"
  >
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="grid gap-2">
        <a
          href="/hub/models/"
          class="flex items-center gap-2 text-sm text-primary-warm-gray"
          ><ArrowLeft class="size-4" />{{ t('cmsEditor.back') }}</a
        >
        <h1 class="text-3xl font-medium">
          {{ t(snapshot ? 'cmsEditor.editTitle' : 'cmsEditor.newTitle') }}
        </h1>
        <p class="text-sm text-admin-muted">
          {{ t('cmsEditor.draftNotice', { revision: draft }) }}
        </p>
      </div>
      <div class="flex max-w-full flex-wrap gap-2">
        <AdminButton href="/hub/models/" size="lg" class="w-40">{{
          t('cmsEditor.cancel')
        }}</AdminButton
        ><AdminButton
          type="submit"
          variant="primary"
          size="lg"
          class="w-40 bg-primary-comfy-yellow text-primary-comfy-ink hover:bg-primary-comfy-yellow/90 focus-visible:outline-primary-comfy-yellow"
          :icon="Save"
          :disabled="saveBlocked"
          >{{
            t(state === 'saving' ? 'cmsEditor.saving' : 'cmsEditor.save')
          }}</AdminButton
        >
      </div>
    </header>
    <EditorStatus
      :deleted="snapshot?.is_deleted"
      :state
      :dirty
      :errors
      :locale
    />
    <div
      :key="editorEpoch"
      class="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]"
    >
      <fieldset :disabled="readOnly" class="grid min-w-0 gap-5">
        <EditorContentFields
          v-model="document"
          v-model:kind="kind"
          :locale
          :existing="Boolean(snapshot)"
          :schema-version="snapshot?.schema_version"
          :disabled="readOnly"
          :valid-change-i-d="validChangeID"
          @edited="state = 'idle'"
        />
        <EditorHero
          v-model="document"
          :locale
          :uid="snapshot?.uid"
          :draft
          :csrf
          @busy="busy"
        />
        <EditorQuestions
          v-model="document"
          :locale
          :invalid="invalidFields.has('faq')"
          @validity="validity('faq', $event)"
        />
        <template v-if="kind === 'workflow'">
          <EditorOutputs
            v-model="document"
            :locale
            :invalid="invalidFields.has('outputs')"
            @validity="validity('outputs', $event)"
          />
          <label class="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              :checked="inputsEnabled"
              @change="patch('runnable', $event)"
            />
            {{ t('cccMetadata.runnable') }}
          </label>
          <p class="text-sm text-admin-muted">
            {{ t('cccMetadata.runnableHint') }}
          </p>
        </template>
        <fieldset
          :disabled="!inputsEnabled"
          :class="!inputsEnabled ? 'min-w-0 opacity-40' : 'min-w-0'"
        >
          <InputsEditor
            v-model="document"
            :locale
            :disabled="!inputsEnabled || readOnly"
            @validity="validity"
          />
        </fieldset>
        <EditorScripts v-if="kind === 'workflow'" v-model="document" :locale />
        <ExamplesEditor
          v-model="document"
          :entity-u-i-d="snapshot?.uid"
          :draft
          :csrf
          :locale
          @validity="validity"
          @busy="busy"
        />
        <EditorWorkflowFiles
          v-if="kind === 'workflow'"
          v-model="document"
          :locale
          :uid="snapshot?.uid"
          :draft
          :csrf
          @busy="busy"
        />
      </fieldset>
      <aside class="grid min-w-0 content-start gap-5">
        <EditorPublishing
          :document
          :locale
          :disabled="readOnly"
          @update="document = $event"
        />
        <EditorActivity
          v-model="document"
          :locale
          :disabled="readOnly"
          :invalid-fields="invalidFields"
          @validity="validity"
        />
        <EditorDeletion
          v-if="snapshot"
          v-model="deleting"
          :snapshot
          :unsaved
          :blocked
          :saving="state === 'saving'"
          :title="value('title')"
          :locale
          @delete="save('delete')"
          @undelete="save('undelete')"
        />
      </aside>
    </div>

    <details class="rounded-2xl border border-admin-line bg-admin-card p-5">
      <summary class="cursor-pointer text-sm text-admin-muted">
        {{ t('cmsEditor.advancedJSON') }}
      </summary>
      <div class="mt-4">
        <JsonField
          :key="editorEpoch"
          :label="t('cmsEditor.completeDocument')"
          :value="document"
          :disabled="completeDocumentBlocked"
          :locale
          @validity="validity('document', $event)"
          @update="replaceDocument"
        />
      </div>
    </details>
    <EditorSaveBar
      v-if="unsaved"
      :blocked="saveBlocked"
      :sidebar
      :busy="state === 'saving' || uploads > 0"
      :locale
      @discard="discardUnsaved"
    />
    <footer v-else class="flex flex-wrap justify-end gap-2">
      <AdminButton href="/hub/models/" size="lg" class="w-40">{{
        t('cmsEditor.cancel')
      }}</AdminButton
      ><AdminButton
        type="submit"
        variant="primary"
        size="lg"
        :icon="Save"
        class="w-40 bg-primary-comfy-yellow text-primary-comfy-ink hover:bg-primary-comfy-yellow/90 focus-visible:outline-primary-comfy-yellow"
        :disabled="saveBlocked"
        >{{ t('cmsEditor.save') }}</AdminButton
      >
    </footer>
  </form>
</template>
