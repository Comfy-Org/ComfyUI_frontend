<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from 'vue'
import { ArrowLeft, Save } from '@lucide/vue'
import { z } from 'astro/zod'
import { zCreateCccItemResponse } from '@comfyorg/ingest-types/zod'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import InputsEditor from './InputsEditor.vue'
import ExamplesEditor from './ExamplesEditor.vue'
import JsonField from './JsonField.vue'
import MediaUpload from './MediaUpload.vue'
import type {
  ContentType,
  Document,
  EditorSnapshot
} from '@/lib/cms/editor-document'
import {
  arrayObjects,
  contentTypes,
  editorSnapshot,
  hasReservedFields,
  jsonObject,
  objectValue,
  savePayload
} from '@/lib/cms/editor-document'
import { editorRequest } from '@/lib/cms/editor-client'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  initial,
  snapshot: initialSnapshot,
  type: initialType,
  draft: initialDraft,
  csrf,
  locale = 'en'
} = defineProps<{
  initial: Document
  snapshot?: EditorSnapshot
  type: ContentType
  draft: number
  csrf: string
  locale?: Locale
}>()
const t = translationsFor(locale).t
const document = ref<Document>(structuredClone(toRaw(initial)))
const snapshot = ref(initialSnapshot)
const kind = ref<ContentType>(initialType)
const draft = ref(initialDraft)
const state = ref<'idle' | 'saving' | 'saved' | 'conflict' | 'failed'>('idle')
const errors = ref<string[]>([])
const invalidFields = ref(new Set<string>())
const uploads = ref(0)
const attempt = ref<{ payload: string; key: string }>()
const ready = ref(false)
onMounted(() => {
  ready.value = true
})
const blocked = computed(
  () =>
    state.value === 'saving' ||
    uploads.value > 0 ||
    invalidFields.value.size > 0
)
const completeDocumentBlocked = computed(
  () =>
    state.value === 'saving' ||
    uploads.value > 0 ||
    [...invalidFields.value].some((key) => key !== 'document')
)
function replaceDocument(next: Document) {
  if (!completeDocumentBlocked.value) document.value = next
}
const inputClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow'
const dirty = computed(
  () =>
    JSON.stringify(document.value) !==
    JSON.stringify(snapshot.value?.document ?? initial)
)
const fields = ['title', 'slug', 'description', 'long_description'] as const
function value(name: string) {
  const raw = document.value[name]
  return typeof raw === 'string' ? raw : ''
}
function patch(name: string, event: Event) {
  const target = event.target
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  )
    return
  const result =
    target instanceof HTMLInputElement && target.type === 'checkbox'
      ? target.checked
      : target.value
  const next = { ...document.value, [name]: result }
  if (
    result === '' &&
    [
      'visible_from',
      'workflow_uid',
      'implementation_ref',
      'router_model_id',
      'author_uid',
      'documentation_url',
      'cloud_share_url',
      'output_type',
      'long_description',
      'description',
      'works_on_cloud'
    ].includes(name)
  )
    delete next[name]
  document.value = next
  if (name === 'works_on_cloud' && result !== '')
    document.value[name] = result === 'true'
  state.value = 'idle'
}
function list(name: string, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  document.value = {
    ...document.value,
    [name]: event.target.value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  }
}
function listValue(name: string) {
  const parsed = z.array(z.string()).safeParse(document.value[name])
  return parsed.success ? parsed.data.join(', ') : ''
}
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
  validity(name, valid)
}
function faqValue(index: number, name: string) {
  const raw = arrayObjects(document.value.faq)[index]?.[name]
  return typeof raw === 'string' ? raw : ''
}
function checkFaq() {
  const questions = new Set<string>()
  const valid = arrayObjects(document.value.faq).every((entry) => {
    const question =
      typeof entry.question === 'string'
        ? entry.question.trim().toLowerCase()
        : ''
    const answer = typeof entry.answer === 'string' ? entry.answer.trim() : ''
    if (!question || !answer || questions.has(question)) return false
    questions.add(question)
    return true
  })
  validity('faq', valid)
}
function faq(index: number, name: string, event: Event) {
  if (
    !(
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
  )
    return
  const value = event.target.value
  document.value = {
    ...document.value,
    faq: arrayObjects(document.value.faq).map((item, at) =>
      at === index ? { ...item, [name]: value } : item
    )
  }
  checkFaq()
}
function addFaq() {
  document.value = {
    ...document.value,
    faq: [...arrayObjects(document.value.faq), { question: '', answer: '' }]
  }
  checkFaq()
}
function removeFaq(index: number) {
  document.value = {
    ...document.value,
    faq: arrayObjects(document.value.faq).filter((_, at) => at !== index)
  }
  checkFaq()
}
function checkOutputs() {
  const seen = new Set<string>()
  validity(
    'outputs',
    arrayObjects(document.value.outputs).every((entry) => {
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
  document.value = {
    ...document.value,
    outputs: arrayObjects(document.value.outputs).map((item, at) =>
      at === index ? { ...item, [name]: value } : item
    )
  }
  checkOutputs()
}
function addOutput() {
  document.value = {
    ...document.value,
    outputs: [
      ...arrayObjects(document.value.outputs),
      { id: '', nodeId: '', key: '', kind: 'image' }
    ]
  }
  checkOutputs()
}
function removeOutput(index: number) {
  document.value = {
    ...document.value,
    outputs: arrayObjects(document.value.outputs).filter(
      (_, at) => at !== index
    )
  }
  checkOutputs()
}
function validity(key: string, valid: boolean) {
  const next = new Set(invalidFields.value)
  if (valid) next.delete(key)
  else next.add(key)
  invalidFields.value = next
}
function busy(active: boolean) {
  uploads.value = Math.max(0, uploads.value + (active ? 1 : -1))
}
function media(name: string, reference: Document | undefined) {
  const next = { ...document.value }
  if (reference) next[name] = reference
  else delete next[name]
  document.value = next
}
function workflowFile(reference: Document | undefined) {
  if (!reference) return
  const files = arrayObjects(document.value.workflow_files)
  document.value = {
    ...document.value,
    workflow_files: [
      ...files,
      {
        name: t('cmsEditor.fileVersion', { count: files.length + 1 }),
        file: reference
      }
    ]
  }
}
function editWorkflowName(index: number, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const name = event.target.value
  document.value = {
    ...document.value,
    workflow_files: arrayObjects(document.value.workflow_files).map(
      (file, i) => (i === index ? { ...file, name } : file)
    )
  }
}
function removeWorkflowFile(index: number) {
  document.value = {
    ...document.value,
    workflow_files: arrayObjects(document.value.workflow_files).filter(
      (_, i) => i !== index
    )
  }
}
async function save() {
  if (blocked.value) return
  if (hasReservedFields(document.value)) {
    state.value = 'failed'
    errors.value = [t('cmsEditor.reservedFields')]
    return
  }
  const body = {
    ...savePayload(document.value, kind.value, draft.value, snapshot.value),
    ...(snapshot.value ? { uid: snapshot.value.uid } : {})
  }
  const payload = JSON.stringify(body)
  if (attempt.value?.payload !== payload)
    attempt.value = { payload, key: crypto.randomUUID() }
  state.value = 'saving'
  errors.value = []
  const response = await editorRequest('save', {
    csrf,
    key: attempt.value?.key,
    body: payload
  })
  if (!response.ok) {
    state.value = response.status === 409 ? 'conflict' : 'failed'
    const details = z
      .object({
        field_errors: z.array(
          z.object({ path: z.string(), message: z.string() })
        )
      })
      .safeParse(response.data)
    errors.value = details.success
      ? details.data.field_errors.map(
          (field) => `${field.path}: ${field.message}`
        )
      : [
          t(
            response.status === 409
              ? 'cmsEditor.conflict'
              : response.status === 403
                ? 'cmsEditor.permissionDenied'
                : 'cmsEditor.saveFailed'
          )
        ]
    return
  }
  const flat = zCreateCccItemResponse.safeParse(response.data)
  const preserved = jsonObject.safeParse(response.data)
  const next =
    flat.success && preserved.success
      ? editorSnapshot({
          ...preserved.data,
          expected_draft_rev: draft.value,
          expected_revision_uid: flat.data.revision_uid
        })
      : undefined
  if (!next) {
    state.value = 'failed'
    errors.value = [t('cmsEditor.invalidResponse')]
    return
  }
  snapshot.value = next
  document.value = structuredClone(next.document)
  state.value = 'saved'
  attempt.value = undefined
  // Keep the authoring page at a stable UID route after first creation.
  window.history.replaceState(null, '', `/admin/content/${next.uid}/edit`)
}
</script>
<template>
  <form
    :data-editor-ready="ready"
    class="grid gap-5 font-admin text-admin-fg"
    @submit.prevent="save"
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
          :disabled="blocked"
          >{{
            t(state === 'saving' ? 'cmsEditor.saving' : 'cmsEditor.save')
          }}</AdminButton
        >
      </div>
    </header>
    <p
      v-if="state === 'saved' && !dirty"
      role="status"
      class="rounded-lg border border-admin-success/30 bg-admin-success/10 p-3 text-sm"
    >
      {{ t('cmsEditor.saved') }}
    </p>
    <div
      v-if="errors.length"
      role="alert"
      class="rounded-lg border border-admin-danger/30 p-4 text-sm text-admin-danger-text"
    >
      <p v-for="error in errors" :key="error">{{ error }}</p>
      <p v-if="state === 'conflict'" class="mt-2 text-admin-muted">
        {{ t('cmsEditor.keepEdits') }}
      </p>
    </div>
    <fieldset
      :disabled="
        state === 'saving' || uploads > 0 || invalidFields.has('document')
      "
      class="grid min-w-0 gap-5"
    >
      <section
        class="grid gap-5 rounded-2xl border border-admin-line bg-admin-card p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div class="grid content-start gap-4">
          <h2 class="text-lg font-medium">{{ t('cmsEditor.pageContent') }}</h2>
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cmsEditor.type')
            }}<select
              v-model="kind"
              :disabled="Boolean(snapshot)"
              :class="inputClass"
            >
              <option v-for="item in contentTypes" :key="item" :value="item">
                {{ item }}
              </option>
            </select></label
          >
          <label
            v-for="field in fields"
            :key="field"
            class="grid gap-1 text-sm text-admin-muted"
            >{{
              field === 'long_description'
                ? t('cccMetadata.longDescription')
                : t(`cmsEditor.${field}`)
            }}<textarea
              v-if="field === 'long_description'"
              :value="value(field)"
              rows="12"
              maxlength="20000"
              :class="inputClass"
              @input="patch(field, $event)" /><input
              v-else
              :value="value(field)"
              :required="field === 'title' || field === 'slug'"
              :maxlength="
                field === 'title'
                  ? snapshot?.schema_version === 1
                    ? 300
                    : 80
                  : field === 'description'
                    ? snapshot?.schema_version === 1
                      ? 20000
                      : 160
                    : 200
              "
              :pattern="field === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined"
              :class="inputClass"
              @input="patch(field, $event)"
          /></label>
          <label
            v-for="field in ['author_uid', 'documentation_url']"
            :key="field"
            class="grid gap-1 text-sm text-admin-muted"
          >
            {{
              t(
                field === 'author_uid'
                  ? 'cccMetadata.author'
                  : 'cccMetadata.documentation'
              )
            }}
            <input
              :value="value(field)"
              :class="inputClass"
              :maxlength="field === 'author_uid' ? 36 : 2000"
              @input="patch(field, $event)"
            />
          </label>
          <p class="text-xs text-admin-muted">
            {{ t('cccMetadata.ownerFixed') }}
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <label
              v-for="field in ['runs', 'downloads']"
              :key="field"
              class="grid gap-1 text-sm text-admin-muted"
            >
              {{
                t(
                  field === 'runs'
                    ? 'cccMetadata.runs'
                    : 'cccMetadata.downloads'
                )
              }}
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
          </div>
          <template v-if="kind === 'workflow'">
            <label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cccMetadata.cloud') }}
              <select
                :value="
                  typeof document.works_on_cloud === 'boolean'
                    ? String(document.works_on_cloud)
                    : ''
                "
                :class="inputClass"
                @change="patch('works_on_cloud', $event)"
              >
                <option value="">{{ t('cccMetadata.unspecified') }}</option>
                <option value="true">{{ t('cccWorkflow.yes') }}</option>
                <option value="false">{{ t('cccWorkflow.no') }}</option>
              </select>
            </label>
            <label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cccMetadata.outputType') }}
              <select
                :value="value('output_type')"
                :class="inputClass"
                @change="patch('output_type', $event)"
              >
                <option value="">{{ t('cccMetadata.unspecified') }}</option>
                <option
                  v-for="output in [
                    'image',
                    'video',
                    'audio',
                    '3d',
                    'text',
                    'mixed'
                  ] as const"
                  :key="output"
                  :value="output"
                >
                  {{ t(`cccWorkflow.output.${output}`) }}
                </option>
              </select>
            </label>
            <label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cccMetadata.models')
              }}<input
                :value="listValue('model_uids')"
                :class="inputClass"
                @input="list('model_uids', $event)"
            /></label>
            <label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cccMetadata.cloudShare')
              }}<input
                :value="value('cloud_share_url')"
                :class="inputClass"
                maxlength="2000"
                @input="patch('cloud_share_url', $event)"
            /></label>
          </template>
          <template v-if="kind === 'model'"
            ><label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cmsEditor.provider')
              }}<input
                :value="value('provider')"
                :class="inputClass"
                @input="patch('provider', $event)" /></label
            ><label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cmsEditor.routerModel')
              }}<input
                :value="value('router_model_id')"
                :class="inputClass"
                @input="patch('router_model_id', $event)" /></label
          ></template>
          <template v-if="kind === 'app'"
            ><label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cmsEditor.implementation')
              }}<input
                :value="value('implementation_ref')"
                :class="inputClass"
                @input="patch('implementation_ref', $event)" /></label
            ><label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cmsEditor.workflowUID')
              }}<input
                :value="value('workflow_uid')"
                :class="inputClass"
                @input="patch('workflow_uid', $event)" /></label
          ></template>
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cmsEditor.tags')
            }}<input
              :value="listValue('tags')"
              :class="inputClass"
              @input="list('tags', $event)"
          /></label>
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cmsEditor.useCases')
            }}<input
              :value="listValue('use_cases')"
              :class="inputClass"
              @input="list('use_cases', $event)"
          /></label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="flex items-center gap-2 text-sm"
              ><input
                type="checkbox"
                :checked="document.enabled === true"
                @change="patch('enabled', $event)"
              />{{ t('cmsEditor.enabled') }}</label
            ><label class="grid gap-1 text-sm text-admin-muted"
              >{{ t('cmsEditor.visibility')
              }}<select
                :value="value('visibility')"
                :class="inputClass"
                @change="patch('visibility', $event)"
              >
                <option value="staff">{{ t('cmsEditor.staff') }}</option>
                <option value="public">{{ t('cmsEditor.public') }}</option>
              </select></label
            >
          </div>
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cmsEditor.visibleFrom')
            }}<input
              :value="value('visible_from')"
              placeholder="2026-10-15T16:00:00Z"
              :class="inputClass"
              @input="patch('visible_from', $event)"
          /></label>
        </div>
        <aside class="grid content-start gap-3">
          <h2 class="text-lg font-medium">{{ t('cmsEditor.hero') }}</h2>
          <MediaUpload
            :reference="document.hero ? objectValue(document.hero) : undefined"
            :entityUID="snapshot?.uid"
            :draft
            :csrf
            :locale
            media-role="hero"
            @update="media('hero', $event)"
            @busy="busy"
          />
          <h3 class="mt-3 text-sm">{{ t('cmsEditor.thumbnail') }}</h3>
          <MediaUpload
            :reference="
              document.thumbnail ? objectValue(document.thumbnail) : undefined
            "
            :entityUID="snapshot?.uid"
            :draft
            :csrf
            :locale
            media-role="thumbnail"
            @update="media('thumbnail', $event)"
            @busy="busy"
          />
        </aside>
      </section>
      <section
        class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-medium">{{ t('cccMetadata.faq') }}</h2>
          <AdminButton @click="addFaq">{{
            t('cccMetadata.addQuestion')
          }}</AdminButton>
        </div>
        <p
          v-if="invalidFields.has('faq')"
          class="text-sm text-admin-danger-text"
        >
          {{ t('cccMetadata.invalidFAQ') }}
        </p>
        <div
          v-for="(_, index) in arrayObjects(document.faq)"
          :key="index"
          class="grid gap-3 rounded-lg border border-admin-line p-4"
        >
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cccMetadata.question', { count: index + 1 })
            }}<input
              :value="faqValue(index, 'question')"
              maxlength="300"
              :class="inputClass"
              @input="faq(index, 'question', $event)"
          /></label>
          <label class="grid gap-1 text-sm text-admin-muted"
            >{{ t('cccMetadata.answer', { count: index + 1 })
            }}<textarea
              :value="faqValue(index, 'answer')"
              rows="5"
              maxlength="20000"
              :class="inputClass"
              @input="faq(index, 'answer', $event)"
            />
          </label>
          <AdminButton @click="removeFaq(index)">{{
            t('cccMetadata.removeQuestion')
          }}</AdminButton>
        </div>
      </section>
      <section
        v-if="kind === 'workflow'"
        class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-medium">{{ t('cccMetadata.outputs') }}</h2>
          <AdminButton @click="addOutput">{{
            t('cccMetadata.addOutput')
          }}</AdminButton>
        </div>
        <p
          v-if="invalidFields.has('outputs')"
          class="text-sm text-admin-danger-text"
        >
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
                v-for="kind in [
                  'image',
                  'video',
                  'audio',
                  '3d',
                  'text'
                ] as const"
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
      <InputsEditor
        v-model="document"
        :locale
        :disabled="
          state === 'saving' || uploads > 0 || invalidFields.has('document')
        "
        @validity="validity"
      />
      <ExamplesEditor
        v-model="document"
        :entityUID="snapshot?.uid"
        :draft
        :csrf
        :locale
        @validity="validity"
        @busy="busy"
      />
      <section
        v-if="kind === 'workflow'"
        class="grid gap-4 rounded-2xl border border-admin-line bg-admin-card p-5"
      >
        <h2 class="text-lg">{{ t('cmsEditor.workflowFiles') }}</h2>
        <div
          v-for="(file, index) in arrayObjects(document.workflow_files)"
          :key="index"
          class="grid gap-2 text-sm text-admin-muted sm:grid-cols-[1fr_auto]"
        >
          <label class="grid gap-1"
            >{{ t('cmsEditor.fileName')
            }}<input
              :value="typeof file.name === 'string' ? file.name : ''"
              :class="inputClass"
              @input="editWorkflowName(index, $event)"
            /><code class="text-xs break-all">{{
              objectValue(file.file).id
            }}</code></label
          ><AdminButton @click="removeWorkflowFile(index)">{{
            t('cmsEditor.detach')
          }}</AdminButton>
        </div>
        <MediaUpload
          :entityUID="snapshot?.uid"
          :draft
          :csrf
          :locale
          media-role="workflow-file"
          @update="workflowFile"
          @busy="busy"
        />
      </section>
    </fieldset>
    <details class="rounded-2xl border border-admin-line bg-admin-card p-5">
      <summary class="cursor-pointer text-sm text-admin-muted">
        {{ t('cmsEditor.advancedJSON') }}
      </summary>
      <div class="mt-4">
        <JsonField
          :label="t('cmsEditor.completeDocument')"
          :value="document"
          :disabled="completeDocumentBlocked"
          :locale
          @validity="validity('document', $event)"
          @update="replaceDocument"
        />
      </div>
    </details>
    <footer class="flex flex-wrap justify-end gap-2">
      <AdminButton href="/hub/models/" size="lg" class="w-40">{{
        t('cmsEditor.cancel')
      }}</AdminButton
      ><AdminButton
        type="submit"
        variant="primary"
        size="lg"
        :icon="Save"
        class="w-40 bg-primary-comfy-yellow text-primary-comfy-ink hover:bg-primary-comfy-yellow/90 focus-visible:outline-primary-comfy-yellow"
        :disabled="blocked"
        >{{ t('cmsEditor.save') }}</AdminButton
      >
    </footer>
  </form>
</template>
