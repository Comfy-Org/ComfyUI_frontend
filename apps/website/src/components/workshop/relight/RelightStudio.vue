<script setup lang="ts">
import { computed, ref } from 'vue'

import { useRelight } from '../../../composables/useRelight'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { lc } from '../../../lib/workshop/relight/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import EditorHistory from '../app-editor/EditorHistory.vue'
import type { EditorView } from '../app-editor/view'
import RelightDocks from './RelightDocks.vue'
import RelightMain from './RelightMain.vue'
import RelightMood from './RelightMood.vue'
import RelightPanel from './RelightPanel.vue'
import RelightRun from './RelightRun.vue'
import RelightTrays from './RelightTrays.vue'
import RelightViewMenu from './RelightViewMenu.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const relight = useRelight(locale)
const { image, phase, view, handles } = relight
const result = ref<EditorView>('compare')
const panel = computed(() => layout !== 'e')
const editing = computed(
  () => Boolean(image.value) && phase.value.kind !== 'done'
)
reportStudioBusy(() => phase.value.kind === 'running')

const panelLabels = {
  label: lc('relight.panel', locale),
  expand: lc('relight.panel.expand', locale),
  collapse: lc('relight.panel.collapse', locale)
}
const historyLabels = {
  group: lc('relight.history', locale),
  undo: lc('relight.tool.undo', locale),
  redo: lc('relight.tool.redo', locale)
}
</script>

<template>
  <AppEditorShell
    :title="lc('relight.title', locale)"
    :tools-label="lc('relight.tools', locale)"
    :panel-labels="panelLabels"
    :panel-dimmed="phase.kind === 'done'"
    :repo="workshopAppRepo('relight')"
    :locale
    data-testid="relight"
    :show-dock="Boolean(image)"
  >
    <RelightMain :relight :view="result" :locale />
    <template v-if="editing" #center>
      <EditorHistory
        :can-undo="relight.canUndo.value"
        :can-redo="relight.canRedo.value"
        :disabled="phase.kind === 'running'"
        :labels="historyLabels"
        @undo="relight.undo"
        @redo="relight.redo"
      />
    </template>
    <template v-if="editing" #end>
      <RelightViewMenu v-model:view="view" v-model:handles="handles" :locale />
    </template>
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ lc('relight.failed', locale) }}
      </EditorAlert>
      <RelightTrays v-if="!panel" :relight :locale />
    </template>
    <template #dock>
      <RelightDocks v-model:view="result" :relight :panel :locale />
    </template>
    <template v-if="panel && image" #panel>
      <RelightPanel :relight :locale />
    </template>
    <template v-if="panel && image" #panel-peek>
      <fieldset :disabled="phase.kind === 'running'" class="min-w-0">
        <RelightMood :relight :locale strip />
      </fieldset>
    </template>
    <template v-if="panel && image" #panel-footer>
      <RelightRun :relight :locale block />
    </template>
  </AppEditorShell>
</template>
