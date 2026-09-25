<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CinematicPlanSharedSettings from './CinematicPlanSharedSettings.vue'
import CinematicPlannedShotEditor from './CinematicPlannedShotEditor.vue'
import CinematicSceneBriefEditor from './CinematicSceneBriefEditor.vue'
import type { Locale } from '../../../i18n/translations'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import type {
  PlanShotMetadata,
  PlanSettingsSnapshot,
  ScenePlanLibrary
} from '../../../lib/workshop/cinematic-studio/scene-builder'
import { tcBuilder } from '../../../lib/workshop/cinematic-studio/builder-copy'
import {
  SCENE_LIMIT,
  composePlannedScene,
  composeSceneBrief,
  createSceneBuilderDraft,
  createScenePlanLibrary,
  parseScenePlanLibrary,
  serializeScenePlanLibrary,
  updateScenePlanLibrary,
  parseSceneBuilderDraft,
  plannedShotMetadata,
  plannedShotTakes,
  planSettingsSchema,
  plannedReferenceIds,
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
  creations = [],
  urls = {},
  sharedSettings,
  referenceChoices = [],
  locale = 'en'
} = defineProps<{
  open: boolean
  scene: string
  namespace: string
  creations?: readonly SavedCreation[]
  urls?: Readonly<Record<string, string>>
  sharedSettings?: PlanSettingsSnapshot
  referenceChoices?: readonly { id: string; label: string }[]
  locale?: Locale
}>()
const emit = defineEmits<{
  'update:open': [boolean]
  apply: [
    scene: string,
    plan?: PlanShotMetadata,
    settings?: PlanSettingsSnapshot,
    referenceIds?: string[]
  ]
  view: [creation: SavedCreation]
  edit: [creation: SavedCreation]
  animate: [creation: SavedCreation]
}>()
const draft = ref(createSceneBuilderDraft(''))
const library = ref(createScenePlanLibrary(draft.value))
const storageReady = ref(false)
const tab = ref<'build' | 'plan'>('build')
const status = ref('')
const revealed = ref<string[]>([])
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
    revealed.value = []
    storageReady.value = false
    if (!isOpen) return
    draft.value = createSceneBuilderDraft(scene.slice(0, SCENE_LIMIT))
    library.value = createScenePlanLibrary(draft.value)
    try {
      const saved = localStorage.getItem(sceneBuilderStorageKey(namespace))
      if (saved) {
        const restored = parseScenePlanLibrary(saved)
        const active = restored.drafts.find(
          (item) => item.plan.id === restored.activeId
        )
        if (!active) throw new Error('Missing active plan')
        library.value = restored
        draft.value = parseSceneBuilderDraft(serializeSceneBuilderDraft(active))
        // Persist identity migration immediately so old v1 drafts do not get new IDs on each open.
        localStorage.setItem(
          sceneBuilderStorageKey(namespace),
          serializeScenePlanLibrary(restored)
        )
      }
      storageReady.value = true
    } catch {
      status.value = t('storageError')
    }
  },
  { immediate: true }
)

function planName(item: ReturnType<typeof createSceneBuilderDraft>) {
  return (
    item.plan.name.trim() || item.plan.scene.slice(0, 60) || t('untitledPlan')
  )
}
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
const takes = computed(() =>
  draft.value.plan.shots.map((_, index) =>
    plannedShotTakes(draft.value.plan, index, creations)
  )
)
function apply(value: string, index?: number) {
  if (!value || value.length > SCENE_LIMIT) return
  const metadata =
    index === undefined
      ? undefined
      : plannedShotMetadata(draft.value.plan, index)
  if (!save()) return
  if (index === undefined || !draft.value.plan.settings)
    emit('apply', value, metadata)
  else
    emit(
      'apply',
      value,
      metadata,
      index === undefined ? undefined : draft.value.plan.settings,
      index === undefined
        ? undefined
        : plannedReferenceIds(draft.value.plan, index)
    )
  emit('update:open', false)
}
function captureSettings() {
  const parsed = planSettingsSchema.safeParse(
    sharedSettings && {
      ...sharedSettings,
      references: referenceChoices.length
        ? [...referenceChoices]
        : sharedSettings.references
    }
  )
  if (!parsed.success) {
    status.value = t('settingsError')
    return
  }
  draft.value.plan.settings = parsed.data
  // A replacement bundle starts with all of its references, never an old bundle's selection.
  for (const shot of draft.value.plan.shots) shot.referenceIds = undefined
}
function selectReference(index: number, id: string, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const ids = plannedReferenceIds(draft.value.plan, index) ?? []
  draft.value.plan.shots[index].referenceIds = event.target.checked
    ? [...new Set([...ids, id])]
    : ids.filter((value) => value !== id)
}
function persist(next: ScenePlanLibrary) {
  try {
    if (!storageReady.value) throw new Error('Plan storage unavailable')
    localStorage.setItem(
      sceneBuilderStorageKey(namespace),
      serializeScenePlanLibrary(next)
    )
    library.value = next
    status.value = t('saved')
    return true
  } catch {
    status.value = t('storageError')
    return false
  }
}
function save() {
  try {
    return persist(updateScenePlanLibrary(library.value, draft.value))
  } catch {
    status.value = t('storageError')
    return false
  }
}
function selectPlan(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return
  const id = event.target.value
  const target = library.value.drafts.find((item) => item.plan.id === id)
  if (!target) return
  try {
    if (!persist(updateScenePlanLibrary(library.value, draft.value, id))) {
      event.target.value = draft.value.plan.id
      return
    }
    draft.value = parseSceneBuilderDraft(serializeSceneBuilderDraft(target))
    revealed.value = []
    revision++
  } catch {
    event.target.value = draft.value.plan.id
    status.value = t('storageError')
  }
}
function addPlan(next: typeof draft.value) {
  try {
    const current = updateScenePlanLibrary(library.value, draft.value)
    if (current.drafts.some((item) => item.plan.id === next.plan.id)) {
      status.value = t('duplicatePlan')
      return false
    }
    if (!persist(updateScenePlanLibrary(current, next))) return false
    draft.value = next
    revealed.value = []
    revision++
    return true
  } catch {
    status.value = t('storageError')
    return false
  }
}
function useTake(action: 'view' | 'edit' | 'animate', creation: SavedCreation) {
  if (
    !urls[creation.id] ||
    (creation.nsfw && !revealed.value.includes(creation.id))
  )
    return
  // Preserve edited shot directions before handing the selected take to another tool.
  if (!save()) return
  if (action === 'view') emit('view', creation)
  else if (action === 'edit') emit('edit', creation)
  else emit('animate', creation)
  emit('update:open', false)
}
function reset() {
  addPlan(createSceneBuilderDraft(scene.slice(0, SCENE_LIMIT)))
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
async function readDraft(file: File) {
  if (file.size > 1000000) throw new Error('File too large')
  return parseSceneBuilderDraft(await file.text())
}
async function importDraft(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const current = revision
  try {
    const parsed = await readDraft(file)
    if (revision !== current || !open) return
    if (addPlan(parsed)) status.value = t('imported')
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
      <div class="grid min-w-0 gap-3 sm:grid-cols-2">
        <label
          class="flex min-w-0 flex-col gap-1 text-sm text-primary-warm-white"
          >{{ t('savedPlans') }}
          <select
            :value="draft.plan.id"
            :class="fieldClass"
            @change="selectPlan"
          >
            <option
              v-for="(item, index) in library.drafts"
              :key="item.plan.id"
              :value="item.plan.id"
            >
              {{ planName(item) }}
              · {{ index + 1 }}
            </option>
          </select>
        </label>
        <label
          class="flex min-w-0 flex-col gap-1 text-sm text-primary-warm-white"
          >{{ t('planName')
          }}<input
            v-model="draft.plan.name"
            :class="fieldClass"
            maxlength="100"
        /></label>
      </div>
      <p class="text-xs text-primary-comfy-canvas">{{ t('libraryNote') }}</p>
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
      <CinematicSceneBriefEditor
        v-if="tab === 'build'"
        v-model="draft.brief"
        :brief
        :field-class
        :locale
        @apply="apply($event)"
      />
      <div v-else class="flex min-w-0 flex-col gap-4">
        <p class="text-sm text-primary-comfy-canvas">{{ t('planNote') }}</p>
        <CinematicPlanSharedSettings
          :settings="draft.plan.settings"
          :shared-settings
          :locale
          @capture="captureSettings"
        />
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
          <CinematicPlannedShotEditor
            v-for="(shot, index) in draft.plan.shots"
            :key="shot.id"
            v-model:shot="draft.plan.shots[index]"
            v-model:revealed="revealed"
            :index
            :plan="draft.plan"
            :preview="shots[index]"
            :takes="takes[index]"
            :urls
            :field-class
            :locale
            @select-reference="(id, event) => selectReference(index, id, event)"
            @apply="apply($event, index)"
            @use-take="useTake"
          />
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
