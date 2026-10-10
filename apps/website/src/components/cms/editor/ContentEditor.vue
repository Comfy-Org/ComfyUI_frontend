<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'

import EditorCover from '@/components/cms/editor/EditorCover.vue'
import EditorDetails from '@/components/cms/editor/EditorDetails.vue'
import EditorExamples from '@/components/cms/editor/EditorExamples.vue'
import EditorHeader from '@/components/cms/editor/EditorHeader.vue'
import EditorParameters from '@/components/cms/editor/EditorParameters.vue'
import EditorPublishing from '@/components/cms/editor/EditorPublishing.vue'
import EditorVersions from '@/components/cms/editor/EditorVersions.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState } from '@/lib/cms/editor'
import { editorProblems } from '@/lib/cms/editor'
import type { SaveNotice } from '@/lib/cms/save-client'
import { noticeFor, saveToDraft } from '@/lib/cms/save-client'
import type { SaveError } from '@/lib/cms/save-item'
import type { ItemVersion } from '@/lib/cms/versions'

const {
  initial,
  base,
  csrf,
  canEdit,
  isLive,
  published = false,
  inDraft,
  versions,
  liveVersion,
  notice,
  canUpload = false,
  locale = 'en'
} = defineProps<{
  initial: EditorState
  base: Record<string, unknown>
  csrf: string
  canEdit: boolean
  isLive: boolean
  /** Has a live version, even an archived one, that an undo goes back to. */
  published?: boolean
  inDraft: boolean
  versions?: ItemVersion[]
  liveVersion?: string
  notice?: SaveNotice
  canUpload?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const state = ref<EditorState>(structuredClone(initial))
const dirty = computed(
  () => JSON.stringify(state.value) !== JSON.stringify(initial)
)
const saving = ref(false)
const error = ref<SaveError>()
const showProblems = ref(false)
const problems = computed(() =>
  showProblems.value ? editorProblems(state.value) : []
)
const kindLabel = t(`cmsAdmin.kind.${initial.kind}`)
const title = computed(() =>
  state.value.isNew
    ? t('cmsAdmin.editor.newTitle', { kind: kindLabel })
    : state.value.name || state.value.slug
)

useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (dirty.value && !saving.value) event.preventDefault()
})

async function save(deleted?: boolean) {
  showProblems.value = true
  if (editorProblems(state.value).length) return
  saving.value = true
  error.value = undefined
  const result = await saveToDraft(
    csrf,
    { ...state.value, deleted: deleted ?? state.value.deleted },
    base
  )
  if (result.ok) {
    window.location.assign(
      `/admin/edit/${state.value.uid}?notice=${noticeFor(deleted)}`
    )
    return
  }
  error.value = result.error
  saving.value = false
}

function discard() {
  state.value = structuredClone(initial)
  showProblems.value = false
}
</script>

<template>
  <form class="grid gap-5 pb-20" novalidate @submit.prevent="save()">
    <EditorHeader
      :title
      :kind-label="kindLabel"
      :is-new="initial.isNew"
      :is-live="isLive"
      :in-draft="inDraft"
      :deleted="initial.deleted"
      :preview-href="
        initial.isNew ? undefined : `${initial.slug}/?preview=DRAFT`
      "
      :can-save="canEdit && !saving && (dirty || initial.isNew)"
      :locale
    />

    <p
      v-if="notice"
      role="status"
      class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-admin-success/25 bg-admin-success/10 px-3 py-2 text-xs"
    >
      <span class="mr-auto">{{ t(`cmsAdmin.editor.notice.${notice}`) }}</span>
      <a href="/admin/" class="font-medium underline-offset-2 hover:underline">
        {{ t('cmsAdmin.editor.goToDraft') }}
      </a>
    </p>
    <p
      v-if="!canEdit"
      class="rounded-lg border border-admin-info/25 bg-admin-info/10 px-3 py-2 text-xs"
    >
      {{ t('cmsAdmin.editor.readOnly') }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="rounded-lg border border-admin-danger/30 bg-admin-danger/10 px-3 py-2 text-xs text-admin-danger-text"
    >
      {{ t(`cmsAdmin.editor.error.${error}`) }}
    </p>

    <div
      class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]"
      :inert="canEdit ? undefined : true"
    >
      <div class="grid min-w-0 gap-5">
        <EditorDetails v-model="state" :problems :locale />
        <EditorCover
          v-model="state.cover"
          :missing="problems.includes('cover')"
          :can-upload="canUpload"
          :locale
        />
        <EditorExamples
          v-model="state.examples"
          :name-prefix="state.slug.split('/').pop() || 'item'"
          :can-upload="canUpload"
          :locale
        />
        <EditorParameters
          v-if="state.parameters.length"
          v-model="state.parameters"
          :locale
        />
      </div>
      <div class="grid content-start gap-5">
        <EditorPublishing
          v-model="state"
          :is-new="initial.isNew"
          :archived="initial.deleted"
          :busy="saving"
          :undo="
            inDraft && canEdit
              ? { csrf, uid: initial.uid, title, published }
              : undefined
          "
          :locale
          @archive="save"
        />
        <EditorVersions
          v-if="versions && versions.length > 1"
          :uid="initial.uid"
          :versions
          :live-version="liveVersion"
          :csrf
          :can-edit="canEdit"
          :locale
        />
      </div>
    </div>

    <div
      v-if="dirty && canEdit"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-admin-line bg-admin-chrome/95 backdrop-blur-sm lg:left-60"
    >
      <div
        class="mx-auto flex max-w-8xl items-center justify-end gap-2 px-4 py-3 sm:px-8"
      >
        <span class="mr-auto text-xs text-admin-muted">
          {{ t('cmsAdmin.editor.unsaved') }}
        </span>
        <AdminButton variant="ghost" @click="discard">
          {{ t('cmsAdmin.editor.discard') }}
        </AdminButton>
        <AdminButton type="submit" variant="primary" :disabled="saving">
          {{ t('cmsAdmin.editor.save') }}
        </AdminButton>
      </div>
    </div>
  </form>
</template>
