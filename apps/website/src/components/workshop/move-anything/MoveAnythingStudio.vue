<script setup lang="ts">
import { ref } from 'vue'

import type { MoveView } from '../../../composables/useMoveAnything'
import { useMoveAnything } from '../../../composables/useMoveAnything'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { mc } from '../../../lib/workshop/move-anything/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorBusy from '../app-editor/EditorBusy.vue'
import MoveAnythingDock from './MoveAnythingDock.vue'
import MoveAnythingEmpty from './MoveAnythingEmpty.vue'
import MoveAnythingHint from './MoveAnythingHint.vue'
import MoveAnythingObjects from './MoveAnythingObjects.vue'
import MoveAnythingQuality from './MoveAnythingQuality.vue'
import MoveAnythingResult from './MoveAnythingResult.vue'
import MoveAnythingResultDock from './MoveAnythingResultDock.vue'
import MoveAnythingStage from './MoveAnythingStage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const move = useMoveAnything(locale)
const { image, objects, phase, tool, tray, quality, selected } = move
const view = ref<MoveView>('compare')
reportStudioBusy(() => phase.value.kind === 'moving')

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
    <MoveAnythingEmpty
      v-if="!image"
      :locale
      @file="move.useFile"
      @example="move.useExample"
    />
    <MoveAnythingResult
      v-else-if="phase.kind === 'done'"
      :image
      :result-url="phase.result.url"
      :view
      :locale
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
      <MoveAnythingHint
        v-if="image && phase.kind === 'arranging'"
        :tool
        :locale
      />
    </template>
    <template #tray>
      <p
        v-if="phase.kind === 'failed'"
        role="alert"
        class="pointer-events-auto rounded-full border border-primary-comfy-red/40 bg-primary-comfy-ink-light px-3 py-1.5 text-xs text-primary-warm-white"
      >
        {{ mc('move.failed', locale) }}
      </p>
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
    <template #dock>
      <MoveAnythingResultDock
        v-if="image && phase.kind === 'done'"
        v-model:view="view"
        :result-url="phase.result.url"
        :file-name="image.name"
        :locale
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
        :can-undo="move.canUndo.value"
        :can-redo="move.canRedo.value"
        :can-generate="move.canGenerate.value"
        :moving="phase.kind === 'moving'"
        :locale
        @tool="(next) => (tool = next)"
        @undo="move.undo"
        @redo="move.redo"
        @file="move.useFile"
        @tray="move.toggleTray"
        @generate="move.generate"
        @cancel="move.cancel"
      />
    </template>
  </AppEditorShell>
</template>
