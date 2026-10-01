<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useBackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { brc } from '../../../lib/workshop/background-removal/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import type { EditorView } from '../app-editor/view'
import BackgroundRemovalDocks from './BackgroundRemovalDocks.vue'
import BackgroundRemovalMain from './BackgroundRemovalMain.vue'
import BackgroundRemovalPanel from './BackgroundRemovalPanel.vue'
import BackgroundRemovalRun from './BackgroundRemovalRun.vue'
import BackgroundRemovalSummary from './BackgroundRemovalSummary.vue'
import BackgroundRemovalTrays from './BackgroundRemovalTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const cutout = useBackgroundRemoval()
const { image, phase } = cutout
const view = ref<EditorView>('compare')
const panel = computed(() => layout !== 'e')
reportStudioBusy(() => phase.value.kind === 'running')
watch(
  () => phase.value.kind === 'done',
  (done) => done && (view.value = 'compare')
)

const panelLabels = {
  label: brc('cutout.panel', locale),
  expand: brc('cutout.panel.expand', locale),
  collapse: brc('cutout.panel.collapse', locale)
}
</script>

<template>
  <AppEditorShell
    :title="brc('cutout.title', locale)"
    :tools-label="brc('cutout.tools', locale)"
    :panel-labels="panelLabels"
    :panel-dimmed="phase.kind === 'done'"
    :repo="workshopAppRepo('background-removal')"
    :locale
    data-testid="background-removal"
    :show-dock="Boolean(image)"
  >
    <BackgroundRemovalMain :cutout :view :locale />
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ brc('cutout.failed', locale) }}
      </EditorAlert>
      <BackgroundRemovalTrays v-if="!panel" :cutout :locale />
    </template>
    <template #dock>
      <BackgroundRemovalDocks v-model:view="view" :cutout :panel :locale />
    </template>
    <template v-if="panel && image" #panel>
      <BackgroundRemovalPanel :cutout :locale />
    </template>
    <template v-if="panel && image" #panel-peek>
      <BackgroundRemovalSummary :cutout :locale />
    </template>
    <template v-if="panel && image" #panel-footer>
      <BackgroundRemovalRun :cutout :locale block />
    </template>
  </AppEditorShell>
</template>
