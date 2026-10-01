<script setup lang="ts">
import { Eye, Lightbulb, Plus, Redo2, SunDim, Undo2 } from '@lucide/vue'

import type { RelightTray } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type {
  Light,
  MoodId,
  RelightScene
} from '../../../lib/workshop/relight/lights'
import { MOOD_LABELS } from '../../../lib/workshop/relight/lights'
import { RELIGHT_CREDITS } from '../../../lib/workshop/relight/mock-run'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorRun from '../app-editor/EditorRun.vue'
import EditorTool from '../app-editor/EditorTool.vue'
import RelightDots from './RelightDots.vue'

const {
  lights,
  mood,
  scene,
  tray,
  full,
  canUndo,
  canRedo,
  canRun,
  running,
  locale = 'en'
} = defineProps<{
  lights: readonly Light[]
  mood: MoodId
  scene: RelightScene
  tray?: RelightTray
  full: boolean
  canUndo: boolean
  canRedo: boolean
  canRun: boolean
  running: boolean
  locale?: Locale
}>()

const preview = defineModel<boolean>('preview', { required: true })
const emit = defineEmits<{
  add: []
  undo: []
  redo: []
  tray: [tray: RelightTray]
  run: []
  cancel: []
}>()
</script>

<template>
  <EditorTool
    :icon="Lightbulb"
    :label="lc('relight.tool.preview', locale)"
    :pressed="preview"
    :disabled="running"
    @click="preview = true"
  />
  <EditorTool
    :icon="Eye"
    :label="lc('relight.tool.original', locale)"
    :pressed="!preview"
    :disabled="running"
    @click="preview = false"
  />
  <EditorDivider />
  <EditorTool
    :icon="Plus"
    :label="lc('relight.tool.add', locale)"
    :disabled="running || full"
    @click="emit('add')"
  />
  <EditorTool
    :icon="Undo2"
    :label="lc('relight.tool.undo', locale)"
    icon-only
    :disabled="running || !canUndo"
    @click="emit('undo')"
  />
  <EditorTool
    :icon="Redo2"
    :label="lc('relight.tool.redo', locale)"
    icon-only
    :disabled="running || !canRedo"
    @click="emit('redo')"
  />
  <EditorDivider />
  <EditorChip
    :label="lc('relight.mood', locale)"
    :value="lc(MOOD_LABELS[mood], locale)"
    :expanded="tray === 'mood'"
    :disabled="running"
    compact
    @click="emit('tray', 'mood')"
  >
    <RelightDots :colors="lights.slice(0, 1).map((light) => light.color)" />
  </EditorChip>
  <EditorChip
    :label="lc('relight.lights', locale)"
    :value="String(lights.length)"
    :expanded="tray === 'lights'"
    :disabled="running"
    compact
    @click="emit('tray', 'lights')"
  >
    <RelightDots :colors="lights.map((light) => light.color)" />
  </EditorChip>
  <EditorChip
    :label="lc('relight.scene', locale)"
    :value="
      lc(
        scene.shadows ? 'relight.scene.shadows' : 'relight.scene.noShadows',
        locale
      )
    "
    :expanded="tray === 'scene'"
    :disabled="running"
    compact
    @click="emit('tray', 'scene')"
  >
    <SunDim
      class="-ml-0.5 size-3.5 text-primary-warm-gray"
      aria-hidden="true"
    />
  </EditorChip>
  <EditorDivider class="max-sm:hidden" />
  <EditorRun
    :label="lc('relight.run', locale)"
    :credits="lc('relight.credits', locale, { n: RELIGHT_CREDITS })"
    :cancel-label="lc('relight.cancel', locale)"
    :running
    :disabled="!canRun"
    data-testid="relight-run"
    @run="emit('run')"
    @cancel="emit('cancel')"
  />
</template>
