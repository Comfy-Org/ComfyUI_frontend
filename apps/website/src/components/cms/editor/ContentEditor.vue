<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { Archive, ArrowLeft, ExternalLink, RotateCcw } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

import EditorExamples from '@/components/cms/editor/EditorExamples.vue'
import EditorMedia from '@/components/cms/editor/EditorMedia.vue'
import EditorParameters from '@/components/cms/editor/EditorParameters.vue'
import EditorSection from '@/components/cms/editor/EditorSection.vue'
import AdminButton from '@/components/cms/ui/AdminButton.vue'
import AdminSegmented from '@/components/cms/ui/AdminSegmented.vue'
import StatusLabel from '@/components/cms/ui/StatusLabel.vue'
import { fieldClass } from '@/components/cms/ui/field'
import Switch from '@/components/ui/switch/Switch.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { EditorState, MediaKind } from '@/lib/cms/editor'
import {
  HUB_SECTION,
  editorProblems,
  pageSlug,
  savedRecord,
  slugify
} from '@/lib/cms/editor'
import type { SaveError, SaveResult } from '@/lib/cms/save-item'

const {
  initial,
  base,
  csrf,
  canEdit,
  isLive,
  inDraft,
  notice,
  locale = 'en'
} = defineProps<{
  initial: EditorState
  base: Record<string, unknown>
  csrf: string
  canEdit: boolean
  isLive: boolean
  inDraft: boolean
  notice?: 'saved' | 'archived' | 'restored'
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const state = reactive<EditorState>(structuredClone(initial))
const saved = ref(JSON.stringify(initial))
const dirty = computed(() => JSON.stringify(state) !== saved.value)
const language = ref<'en' | 'zh-CN'>('en')
const saving = ref(false)
const error = ref<SaveError>()
const showProblems = ref(false)
const problems = computed(() => editorProblems(state))
const slugTouched = ref(!state.isNew)
const section = HUB_SECTION[state.kind]
const kindLabel = t(`cmsAdmin.kind.${state.kind}`)

const slugEnd = computed({
  get: () => state.slug.split('/').pop() ?? '',
  set: (value: string) => {
    slugTouched.value = true
    state.slug = `/hub/${section}/${slugify(value)}`
  }
})
watch(
  () => state.name,
  (name) => {
    if (state.isNew && !slugTouched.value)
      state.slug = pageSlug(state.kind, name)
  }
)

const languages = [
  { value: 'en' as const, label: 'English' },
  { value: 'zh-CN' as const, label: '中文' }
]
const mediaKinds: ReadonlyArray<{ value: MediaKind; label: string }> = [
  { value: 'image', label: t('cmsAdmin.editor.media.image') },
  { value: 'video', label: t('cmsAdmin.editor.media.video') }
]
const title = computed(() =>
  state.isNew
    ? t('cmsAdmin.editor.newTitle', { kind: kindLabel })
    : state.name || state.slug
)
const creditLabel =
  state.kind === 'MODEL'
    ? t('cmsAdmin.editor.provider')
    : t('cmsAdmin.editor.author')

useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (dirty.value && !saving.value) event.preventDefault()
})

async function save(next: Partial<Pick<EditorState, 'deleted'>> = {}) {
  showProblems.value = true
  if (problems.value.length) return
  saving.value = true
  error.value = undefined
  const form = new FormData()
  form.set('csrf', csrf)
  form.set('action', 'save')
  form.set('uid', state.uid)
  form.set('record', JSON.stringify(savedRecord({ ...state, ...next }, base)))
  try {
    const response = await fetch('/admin/actions', {
      method: 'POST',
      body: form
    })
    const result = (await response.json()) as SaveResult
    if (result.ok) {
      const kind =
        next.deleted === undefined
          ? 'saved'
          : next.deleted
            ? 'archived'
            : 'restored'
      saved.value = JSON.stringify(state)
      window.location.assign(`/admin/edit/${state.uid}?notice=${kind}`)
      return
    }
    error.value = result.error
  } catch {
    error.value = 'failed'
  }
  saving.value = false
}

function discard() {
  Object.assign(state, structuredClone(initial))
  showProblems.value = false
}
</script>

<template>
  <form class="grid gap-5 pb-20" novalidate @submit.prevent="save()">
    <a
      href="/admin/content/"
      class="inline-flex w-fit items-center gap-1.5 text-xs text-admin-muted hover:text-admin-fg"
    >
      <ArrowLeft class="size-3.5" aria-hidden="true" />
      {{ t('cmsAdmin.nav.content') }}
    </a>

    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="grid max-w-2xl min-w-0 gap-2">
        <h1
          class="text-admin-title leading-tight font-normal wrap-break-word text-admin-fg"
        >
          {{ title }}
        </h1>
        <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span class="text-admin-muted">{{ kindLabel }}</span>
          <StatusLabel
            v-if="state.isNew || !isLive"
            tone="success"
            :label="t('cmsAdmin.change.new')"
          />
          <StatusLabel
            v-if="initial.deleted"
            tone="muted"
            :label="t('cmsAdmin.editor.archived')"
          />
          <StatusLabel
            v-else-if="inDraft"
            tone="info"
            :label="t('cmsAdmin.content.inDraft')"
          />
          <StatusLabel
            v-else-if="isLive"
            tone="success"
            :label="t('cmsAdmin.editor.live')"
          />
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminButton
          v-if="!state.isNew"
          :href="`${initial.slug}/?preview=DRAFT`"
          target="_blank"
          :icon="ExternalLink"
        >
          {{ t('cmsAdmin.editor.previewPage') }}
        </AdminButton>
        <AdminButton
          type="submit"
          variant="primary"
          :disabled="!canEdit || saving || (!dirty && !state.isNew)"
        >
          {{ t('cmsAdmin.editor.save') }}
        </AdminButton>
      </div>
    </header>

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
      :inert="!canEdit"
    >
      <div class="grid min-w-0 gap-5">
        <EditorSection
          :title="t('cmsAdmin.editor.details')"
          :description="
            language === 'en'
              ? t('cmsAdmin.editor.detailsHelp')
              : t('cmsAdmin.editor.translationHelp')
          "
        >
          <template #actions>
            <AdminSegmented
              v-model="language"
              :options="languages"
              :label="t('cmsAdmin.editor.language')"
            />
          </template>
          <template v-if="language === 'en'">
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.name') }}
              <input
                v-model="state.name"
                :class="fieldClass"
                :aria-invalid="showProblems && problems.includes('name')"
              />
              <span
                v-if="showProblems && problems.includes('name')"
                class="text-admin-danger-text"
              >
                {{ t('cmsAdmin.editor.problem.name') }}
              </span>
            </label>
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.summary') }}
              <textarea v-model="state.summary" rows="3" :class="fieldClass" />
            </label>
            <div class="grid gap-4 md:grid-cols-2">
              <label
                v-if="state.kind !== 'APP'"
                class="grid gap-1.5 text-xs text-admin-muted"
              >
                {{ creditLabel }}
                <input v-model="state.credit" :class="fieldClass" />
              </label>
              <label class="grid gap-1.5 text-xs text-admin-muted">
                {{ t('cmsAdmin.editor.tags') }}
                <input
                  v-model="state.tags"
                  :placeholder="t('cmsAdmin.editor.tagsPlaceholder')"
                  :class="fieldClass"
                />
              </label>
            </div>
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.address') }}
              <span
                class="flex items-center rounded-lg border border-admin-field bg-admin-page text-sm has-focus-visible:border-admin-control"
              >
                <span class="pl-3 text-admin-subtle">/hub/{{ section }}/</span>
                <input
                  v-model.lazy="slugEnd"
                  :disabled="!state.isNew"
                  class="min-w-0 flex-1 bg-transparent py-2 pr-3 text-admin-fg outline-none disabled:cursor-not-allowed disabled:text-admin-muted"
                  :aria-invalid="showProblems && problems.includes('slug')"
                />
              </span>
              <span
                v-if="showProblems && problems.includes('slug')"
                class="text-admin-danger-text"
              >
                {{ t('cmsAdmin.editor.problem.slug') }}
              </span>
              <span v-else-if="!state.isNew" class="text-admin-subtle">
                {{ t('cmsAdmin.editor.addressFixed') }}
              </span>
            </label>
          </template>
          <template v-else>
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.name') }}
              <input
                v-model="state.translation.name"
                lang="zh-CN"
                :placeholder="state.name"
                :class="fieldClass"
              />
            </label>
            <label class="grid gap-1.5 text-xs text-admin-muted">
              {{ t('cmsAdmin.editor.summary') }}
              <textarea
                v-model="state.translation.summary"
                lang="zh-CN"
                rows="3"
                :placeholder="state.summary"
                :class="fieldClass"
              />
            </label>
          </template>
        </EditorSection>

        <EditorSection
          :title="t('cmsAdmin.editor.cover')"
          :description="t('cmsAdmin.editor.coverHelp')"
        >
          <div class="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
            <EditorMedia
              :url="state.cover.url"
              :kind="state.cover.kind"
              class="aspect-4/3"
            />
            <div class="grid content-start gap-3">
              <AdminSegmented
                v-model="state.cover.kind"
                :options="mediaKinds"
                :label="t('cmsAdmin.editor.media.kind')"
              />
              <label class="grid gap-1.5 text-xs text-admin-muted">
                {{ t('cmsAdmin.editor.media.url') }}
                <input
                  v-model="state.cover.url"
                  type="url"
                  :placeholder="t('cmsAdmin.editor.media.placeholder')"
                  :class="fieldClass"
                  :aria-invalid="showProblems && problems.includes('cover')"
                />
                <span
                  v-if="showProblems && problems.includes('cover')"
                  class="text-admin-danger-text"
                >
                  {{ t('cmsAdmin.editor.problem.cover') }}
                </span>
              </label>
            </div>
          </div>
        </EditorSection>

        <EditorExamples
          v-model="state.examples"
          :name-prefix="state.slug.split('/').pop() || 'item'"
          :locale
        />

        <EditorParameters
          v-if="state.parameters.length"
          v-model="state.parameters"
          :locale
        />
      </div>

      <aside class="grid gap-5 lg:sticky lg:top-6">
        <EditorSection :title="t('cmsAdmin.editor.visibility')">
          <label class="flex items-center justify-between gap-3 text-sm">
            {{ t('cmsAdmin.editor.shown') }}
            <Switch v-model="state.enabled" />
          </label>
          <label class="grid gap-1.5 text-xs text-admin-muted">
            {{ t('cmsAdmin.editor.audience') }}
            <select v-model="state.visibility" :class="fieldClass">
              <option value="PUBLIC">
                {{ t('cmsAdmin.editor.everyone') }}
              </option>
              <option value="STAFF">{{ t('cmsAdmin.editor.staff') }}</option>
            </select>
          </label>
          <label class="grid gap-1.5 text-xs text-admin-muted">
            {{ t('cmsAdmin.editor.appearsFrom') }}
            <input
              v-model="state.visibleFrom"
              type="datetime-local"
              :class="fieldClass"
            />
            <span class="text-admin-subtle">
              {{ t('cmsAdmin.editor.appearsHelp') }}
            </span>
          </label>
        </EditorSection>

        <EditorSection
          v-if="!state.isNew"
          :title="t('cmsAdmin.editor.archiveTitle')"
          :description="
            initial.deleted
              ? t('cmsAdmin.editor.restoreHelp')
              : t('cmsAdmin.editor.archiveHelp')
          "
        >
          <AdminButton
            v-if="initial.deleted"
            :icon="RotateCcw"
            :disabled="saving"
            @click="save({ deleted: false })"
          >
            {{ t('cmsAdmin.editor.restore') }}
          </AdminButton>
          <AdminButton
            v-else
            variant="dangerGhost"
            :icon="Archive"
            :disabled="saving"
            class="justify-self-start"
            @click="save({ deleted: true })"
          >
            {{ t('cmsAdmin.editor.archive') }}
          </AdminButton>
        </EditorSection>
      </aside>
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
