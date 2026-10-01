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
import EditorHistory from '../app-editor/EditorHistory.vue'
import MoveAnythingDocks from './MoveAnythingDocks.vue'
import MoveAnythingMain from './MoveAnythingMain.vue'
import MoveAnythingPanel from './MoveAnythingPanel.vue'
import MoveAnythingQualityPicker from './MoveAnythingQualityPicker.vue'
import MoveAnythingRun from './MoveAnythingRun.vue'
import MoveAnythingTrays from './MoveAnythingTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const move = useMoveAnything(locale)
const { image, phase, quality } = move
const view = ref<MoveView>('compare')
const panel = computed(() => layout !== 'e')
reportStudioBusy(() => phase.value.kind === 'moving')

const historyLabels = {
  group: mc('move.history', locale),
  undo: mc('move.tool.undo', locale),
  redo: mc('move.tool.redo', locale)
}
const panelLabels = {
  label: mc('move.panel', locale),
  expand: mc('move.panel.expand', locale),
  collapse: mc('move.panel.collapse', locale)
}
</script>

<template>
  <AppEditorShell
    :title="mc('move.title', locale)"
    :tools-label="mc('move.tools', locale)"
    :panel-labels="panelLabels"
    :panel-dimmed="phase.kind === 'done'"
    :repo="workshopAppRepo('move-anything')"
    :locale
    data-testid="move-anything"
    :show-dock="Boolean(image)"
  >
    <MoveAnythingMain :move :view :locale />
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ mc('move.failed', locale) }}
      </EditorAlert>
      <MoveAnythingTrays v-if="!panel" :move :locale />
    </template>
    <template v-if="image && phase.kind !== 'done'" #center>
      <EditorHistory
        :can-undo="move.canUndo.value"
        :can-redo="move.canRedo.value"
        :disabled="phase.kind === 'moving'"
        :labels="historyLabels"
        @undo="move.undo"
        @redo="move.redo"
      />
    </template>
    <template #dock>
      <MoveAnythingDocks v-model:view="view" :move :panel :locale />
    </template>
    <template v-if="panel && image" #panel>
      <MoveAnythingPanel :image :move :locale />
    </template>
    <template v-if="panel && image" #panel-peek>
      <fieldset :disabled="phase.kind === 'moving'" class="min-w-0 py-1">
        <MoveAnythingQualityPicker v-model="quality" :locale />
      </fieldset>
    </template>
    <template v-if="panel && image" #panel-footer>
      <MoveAnythingRun :move :locale block />
    </template>
  </AppEditorShell>
</template>
