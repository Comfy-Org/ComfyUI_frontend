<script setup lang="ts">
import { computed, ref } from 'vue'

import type { MoveView } from '../../../composables/useMoveAnything'
import { useMoveAnything } from '../../../composables/useMoveAnything'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { mc } from '../../../lib/workshop/move-anything/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorEmpty from '../app-editor/EditorEmpty.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import EditorHistory from '../app-editor/EditorHistory.vue'
import EditorResult from '../app-editor/EditorResult.vue'
import EditorResultDock from '../app-editor/EditorResultDock.vue'
import { MOVE_EXAMPLE } from '../../../lib/workshop/move-anything/mock-run'
import MoveAnythingDock from './MoveAnythingDock.vue'
import MoveAnythingObjects from './MoveAnythingObjects.vue'
import MoveAnythingQuality from './MoveAnythingQuality.vue'
import MoveAnythingStage from './MoveAnythingStage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const move = useMoveAnything(locale)
const { image, objects, phase, tool, tray, quality, selected } = move
const view = ref<MoveView>('compare')
reportStudioBusy(() => phase.value.kind === 'moving')

const resultLabels = computed(() => ({
  resultAlt: mc('move.alt.result', locale),
  originalAlt:
    image.value?.url === MOVE_EXAMPLE.url
      ? mc('move.alt.example', locale)
      : (image.value?.name ?? ''),
  original: mc('move.view.original', locale),
  result: mc('move.view.result', locale),
  slider: mc('move.compare', locale)
}))
const dockLabels = {
  compare: mc('move.view.compare', locale),
  result: mc('move.view.result', locale),
  original: mc('move.view.original', locale),
  edit: mc('move.edit', locale),
  again: mc('move.again', locale),
  download: mc('move.download', locale)
}

function busyDetail() {
  return mc('move.busy.detail', locale, {
    n: move.moved.value.length,
    wait: mc(
      quality.value === 'fast'
        ? 'move.quality.fastHint'
        : 'move.quality.bestHint',
      locale
    )
  })
}
</script>

<template>
  <AppEditorShell
    :title="mc('move.title', locale)"
    :tools-label="mc('move.tools', locale)"
    :repo="workshopAppRepo('move-anything')"
    :locale
    data-testid="move-anything"
    :show-dock="Boolean(image)"
  >
    <EditorEmpty
      v-if="!image"
      :title="mc('move.empty.title', locale)"
      :meta="mc('move.empty.meta', locale)"
      :upload-label="mc('move.empty.upload', locale)"
      :example-label="mc('move.empty.example', locale)"
      :example-image="MOVE_EXAMPLE.url"
      data-testid="move-empty"
      @file="move.useFile"
      @example="move.useExample"
    />
    <EditorResult
      v-else-if="phase.kind === 'done'"
      :before="image.url"
      :after="phase.result.url"
      :view
      :width="image.width"
      :height="image.height"
      :labels="resultLabels"
    />
    <div v-else class="relative size-full">
      <MoveAnythingStage
        :image
        :objects
        :tool
        :selected
        :locale
        @select="(id) => (selected = id)"
        @begin="move.checkpoint"
        @place="move.place"
        @add="move.add"
      />
      <EditorBusy
        v-if="phase.kind === 'moving'"
        :title="mc('move.busy.title', locale)"
        :detail="busyDetail()"
      />
    </div>
    <template #overlay>
      <EditorHint
        v-if="image && phase.kind === 'arranging'"
        :text="mc(tool === 'add' ? 'move.hint.add' : 'move.hint.move', locale)"
      />
    </template>
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ mc('move.failed', locale) }}
      </EditorAlert>
      <MoveAnythingObjects
        v-if="tray === 'objects'"
        :objects
        :selected
        :locale
        @select="(id) => (selected = id)"
        @remove="move.remove"
        @add="tool = 'add'"
        @close="tray = undefined"
      />
      <MoveAnythingQuality
        v-if="tray === 'quality'"
        v-model="quality"
        :locale
        @close="tray = undefined"
      />
    </template>
    <template v-if="image && phase.kind !== 'done'" #start>
      <EditorHistory
        :can-undo="move.canUndo.value"
        :can-redo="move.canRedo.value"
        :disabled="phase.kind === 'moving'"
        :labels="{
          group: mc('move.history', locale),
          undo: mc('move.tool.undo', locale),
          redo: mc('move.tool.redo', locale)
        }"
        @undo="move.undo"
        @redo="move.redo"
      />
    </template>
    <template #dock>
      <EditorResultDock
        v-if="image && phase.kind === 'done'"
        v-model:view="view"
        :href="phase.result.url"
        :file-name="`moved-${image.name}`"
        :labels="dockLabels"
        @edit="move.edit"
        @again="move.generate"
      />
      <MoveAnythingDock
        v-else
        :image
        :tool
        :tray
        :quality
        :object-count="objects.length"
        :moved-count="move.moved.value.length"
        :can-generate="move.canGenerate.value"
        :moving="phase.kind === 'moving'"
        :locale
        @tool="(next) => (tool = next)"
        @file="move.useFile"
        @tray="move.toggleTray"
        @generate="move.generate"
        @cancel="move.cancel"
      />
    </template>
  </AppEditorShell>
</template>
