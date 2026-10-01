<script setup lang="ts">
import { MousePointer2 } from '@lucide/vue'
import { ref } from 'vue'

import type { MoveView } from '../../../composables/useMoveAnything'
import { useMoveAnything } from '../../../composables/useMoveAnything'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { mc } from '../../../lib/workshop/move-anything/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorCompare from '../app-editor/EditorCompare.vue'
import EditorFrame from '../app-editor/EditorFrame.vue'
import MoveAnythingDock from './MoveAnythingDock.vue'
import MoveAnythingEmpty from './MoveAnythingEmpty.vue'
import MoveAnythingObjects from './MoveAnythingObjects.vue'
import MoveAnythingQuality from './MoveAnythingQuality.vue'
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
    <div v-else-if="phase.kind === 'done'" class="size-full max-w-5xl">
      <EditorCompare
        v-if="view === 'compare'"
        :before="image.url"
        :after="phase.result.url"
        :alt="mc('move.alt.result', locale)"
        :before-label="mc('move.view.original', locale)"
        :after-label="mc('move.view.result', locale)"
        :slider-label="mc('move.compare', locale)"
        :width="image.width"
        :height="image.height"
      />
      <EditorFrame v-else :width="image.width" :height="image.height">
        <img
          :src="view === 'result' ? phase.result.url : image.url"
          :alt="
            mc(
              view === 'result' ? 'move.alt.result' : 'move.alt.example',
              locale
            )
          "
          class="size-full rounded-sm object-cover"
        />
      </EditorFrame>
    </div>
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
      <p
        v-if="image && phase.kind === 'arranging'"
        class="pointer-events-none absolute top-3.5 left-1/2 flex h-6.5 -translate-x-1/2 items-center gap-1.5 rounded-full border border-transparency-white-t8 bg-primary-comfy-ink-light/90 px-2.5 text-[11px] whitespace-nowrap text-primary-warm-gray max-sm:hidden"
      >
        <MousePointer2 class="size-3" aria-hidden="true" />
        {{ mc(tool === 'add' ? 'move.hint.add' : 'move.hint.move', locale) }}
      </p>
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
