<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Locale } from '../../../i18n/translations'
import { tcBuilder } from '../../../lib/workshop/cinematic-studio/builder-copy'
import {
  BRIEF_FIELDS,
  SCENE_LIMIT,
  composePlannedScene,
  composeSceneBrief,
  createSceneBuilderDraft,
  parseSceneBuilderDraft,
  sceneBuilderStorageKey,
  serializeSceneBuilderDraft
} from '../../../lib/workshop/cinematic-studio/scene-builder'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'

const {
  open,
  scene,
  namespace,
  locale = 'en'
} = defineProps<{
  open: boolean
  scene: string
  namespace: string
  locale?: Locale
}>()
const emit = defineEmits<{ 'update:open': [boolean]; apply: [scene: string] }>()
const draft = ref(createSceneBuilderDraft(''))
const tab = ref<'build' | 'plan'>('build')
const status = ref('')
const input = ref<HTMLInputElement>()
let revision = 0
const t = (key: Parameters<typeof tcBuilder>[0]) => tcBuilder(key, locale)
const fieldClass =
  'w-full min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink px-3 py-2 text-sm text-primary-warm-white'

watch(
  () => [open, namespace] as const,
  ([isOpen]) => {
    revision++
    status.value = ''
    if (!isOpen) return
    draft.value = createSceneBuilderDraft(scene.slice(0, SCENE_LIMIT))
    try {
      const saved = localStorage.getItem(sceneBuilderStorageKey(namespace))
      if (saved) draft.value = parseSceneBuilderDraft(saved)
    } catch {
      status.value = t('storageError')
    }
  },
  { immediate: true }
)

function preview(compose: () => string) {
  try {
    return { text: compose(), valid: true }
  } catch {
    return { text: '', valid: false }
  }
}
const brief = computed(() =>
  preview(() => composeSceneBrief(draft.value.brief))
)
const shots = computed(() =>
  draft.value.plan.shots.map((_, index) =>
    preview(() => composePlannedScene(draft.value.plan, index))
  )
)
function apply(value: string) {
  if (!value || value.length > SCENE_LIMIT) return
  emit('apply', value)
  emit('update:open', false)
}
function save() {
  try {
    localStorage.setItem(
      sceneBuilderStorageKey(namespace),
      serializeSceneBuilderDraft(draft.value)
    )
    status.value = t('saved')
  } catch {
    status.value = t('storageError')
  }
}
function reset() {
  draft.value = createSceneBuilderDraft(scene.slice(0, SCENE_LIMIT))
  status.value = ''
}
function exportDraft() {
  const blob = new Blob([serializeSceneBuilderDraft(draft.value)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'cinema-scene-draft.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function importDraft(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const current = revision
  try {
    if (file.size > 1000000) throw new Error('File too large')
    const parsed = parseSceneBuilderDraft(await file.text())
    if (revision !== current || !open) return
    draft.value = parsed
    status.value = t('imported')
  } catch {
    if (revision === current) status.value = t('importError')
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto sm:max-w-4xl"
      :close-label="t('cancel')"
    >
      <DialogTitle class="pr-12">{{ t('title') }}</DialogTitle>
      <DialogDescription>{{ t('description') }}</DialogDescription>
      <div class="flex flex-wrap gap-2" :aria-label="t('title')">
        <Button
          :variant="tab === 'build' ? 'default' : 'outline'"
          :aria-pressed="tab === 'build'"
          @click="tab = 'build'"
          >{{ t('build') }}</Button
        >
        <Button
          :variant="tab === 'plan' ? 'default' : 'outline'"
          :aria-pressed="tab === 'plan'"
          @click="tab = 'plan'"
          >{{ t('plan') }}</Button
        >
      </div>
      <div v-if="tab === 'build'" class="grid min-w-0 gap-5 md:grid-cols-2">
        <div class="flex min-w-0 flex-col gap-3">
          <label
            v-for="field in BRIEF_FIELDS"
            :key="field"
            class="flex flex-col gap-1 text-sm text-primary-warm-white"
          >
            {{ t(field)
            }}<span
              v-if="field !== 'subject'"
              class="text-xs text-primary-comfy-canvas"
              >{{ t('optional') }}</span
            >
            <textarea
              v-model="draft.brief[field]"
              :class="fieldClass"
              :maxlength="SCENE_LIMIT"
              :rows="field === 'subject' ? 4 : 2"
            />
          </label>
        </div>
        <section class="min-w-0">
          <h3 class="mb-2 text-sm font-semibold text-primary-warm-white">
            {{ t('preview') }}
          </h3>
          <p
            class="rounded-xl border border-transparency-white-t8 p-4 text-sm/relaxed wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas"
          >
            {{ brief.valid ? brief.text : t('invalid') }}
          </p>
          <p class="my-3 text-xs text-primary-comfy-canvas">
            {{ brief.text.length }} / {{ SCENE_LIMIT }} {{ t('characters') }}
          </p>
          <Button :disabled="!brief.valid" @click="apply(brief.text)">{{
            t('apply')
          }}</Button>
        </section>
      </div>
      <div v-else class="flex min-w-0 flex-col gap-4">
        <p class="text-sm text-primary-comfy-canvas">{{ t('planNote') }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label
            v-for="field in [
              'scene',
              'character',
              'setting',
              'continuity'
            ] as const"
            :key="field"
            class="flex min-w-0 flex-col gap-1 text-sm text-primary-warm-white"
          >
            {{ t(field) }}
            <textarea
              v-model="draft.plan[field]"
              :class="fieldClass"
              :maxlength="SCENE_LIMIT"
              rows="3"
            />
          </label>
        </div>
        <div class="grid gap-3 lg:grid-cols-3">
          <article
            v-for="(shot, index) in draft.plan.shots"
            :key="index"
            class="flex min-w-0 flex-col gap-3 rounded-xl border border-transparency-white-t8 p-3"
          >
            <label class="flex flex-col gap-1 text-sm text-primary-warm-white"
              >{{ index + 1 }} · {{ t('shotTitle')
              }}<input v-model="shot.title" :class="fieldClass" maxlength="100"
            /></label>
            <label class="flex flex-col gap-1 text-sm text-primary-warm-white"
              >{{ t('action')
              }}<textarea
                v-model="shot.action"
                :class="fieldClass"
                :maxlength="SCENE_LIMIT"
                rows="2"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm text-primary-warm-white"
              >{{ t('framing')
              }}<textarea
                v-model="shot.framing"
                :class="fieldClass"
                :maxlength="SCENE_LIMIT"
                rows="5"
              />
            </label>
            <details class="text-sm text-primary-comfy-canvas">
              <summary class="cursor-pointer">{{ t('preview') }}</summary>
              <p class="mt-2 wrap-break-word whitespace-pre-wrap">
                {{ shots[index].valid ? shots[index].text : t('invalid') }}
              </p>
            </details>
            <Button
              :disabled="!shots[index].valid"
              @click="apply(shots[index].text)"
              >{{ t('apply') }}</Button
            >
          </article>
        </div>
      </div>
      <p v-if="status" role="status" class="text-sm text-primary-comfy-canvas">
        {{ status }}
      </p>
      <div
        class="flex flex-wrap gap-2 border-t border-transparency-white-t8 pt-4"
      >
        <Button variant="outline" @click="save">{{ t('save') }}</Button>
        <Button variant="outline" @click="exportDraft">{{
          t('export')
        }}</Button>
        <Button variant="outline" @click="input?.click()">{{
          t('import')
        }}</Button>
        <Button variant="outline" @click="reset">{{ t('reset') }}</Button>
        <Button variant="outline" @click="emit('update:open', false)">{{
          t('cancel')
        }}</Button>
        <input
          ref="input"
          class="hidden"
          type="file"
          accept="application/json,.json"
          :aria-label="t('import')"
          @change="importDraft"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
