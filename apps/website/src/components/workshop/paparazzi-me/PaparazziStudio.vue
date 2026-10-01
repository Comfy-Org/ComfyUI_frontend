<script setup lang="ts">
import { computed } from 'vue'

import { usePaparazziMe } from '../../../composables/usePaparazziMe'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import PaparazziDocks from './PaparazziDocks.vue'
import PaparazziMain from './PaparazziMain.vue'
import PaparazziPanel from './PaparazziPanel.vue'
import PaparazziRun from './PaparazziRun.vue'
import PaparazziSummary from './PaparazziSummary.vue'
import PaparazziTrays from './PaparazziTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const paparazzi = usePaparazziMe()
const { phase } = paparazzi
const panel = computed(() => layout !== 'e')
reportStudioBusy(() => phase.value.kind === 'running')

const panelLabels = {
  label: pc('paparazzi.panel', locale),
  expand: pc('paparazzi.panel.expand', locale),
  collapse: pc('paparazzi.panel.collapse', locale)
}
</script>

<template>
  <AppEditorShell
    :title="pc('paparazzi.title', locale)"
    :tools-label="pc('paparazzi.tools', locale)"
    :panel-labels="panelLabels"
    :panel-dimmed="phase.kind === 'done'"
    :repo="workshopAppRepo('paparazzi-me')"
    :locale
    data-testid="paparazzi-me"
  >
    <PaparazziMain :paparazzi :locale />
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ pc('paparazzi.failed', locale) }}
      </EditorAlert>
      <PaparazziTrays v-if="!panel" :paparazzi :locale />
    </template>
    <template #dock>
      <PaparazziDocks :paparazzi :panel :locale />
    </template>
    <template v-if="panel" #panel>
      <PaparazziPanel :paparazzi :locale />
    </template>
    <template v-if="panel" #panel-peek>
      <PaparazziSummary :paparazzi :locale />
    </template>
    <template v-if="panel" #panel-footer>
      <PaparazziRun :paparazzi :locale block />
    </template>
  </AppEditorShell>
</template>
