<script setup lang="ts">
import { ref } from 'vue'

import type { MoveView } from '@/composables/useMoveAnything'
import { useMoveAnything } from '@/composables/useMoveAnything'
import { reportStudioBusy } from '@/composables/useStudioSwitchGuard'
import type { Locale } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { mc } from '@/lib/workshop/move-anything/copy'
import AppEditorShell from '@/components/workshop/app-editor/AppEditorShell.vue'
import EditorHistory from '@/components/workshop/app-editor/EditorHistory.vue'
import MoveAnythingDock from './MoveAnythingDock.vue'
import MoveAnythingEmpty from './MoveAnythingEmpty.vue'
import MoveAnythingObjects from './MoveAnythingObjects.vue'
import MoveAnythingQuality from './MoveAnythingQuality.vue'
import MoveAnythingResult from './MoveAnythingResult.vue'
import MoveAnythingResultDock from './MoveAnythingResultDock.vue'
import MoveAnythingWorkspace from './MoveAnythingWorkspace.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const move = useMoveAnything(locale)
const { image, objects, phase, tool, tray, quality, selected } = move
const view = ref<MoveView>('compare')
reportStudioBusy(() => phase.value.kind === 'moving')
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
    <MoveAnythingWorkspace v-else :image :move :locale />
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
    <template v-if="image && phase.kind !== 'done'" #center>
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
