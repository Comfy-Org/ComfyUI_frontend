<script setup lang="ts">
import { computed, ref } from 'vue'

import { useRelight } from '../../../composables/useRelight'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { lc } from '../../../lib/workshop/relight/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import type { EditorView } from '../app-editor/view'
import RelightDocks from './RelightDocks.vue'
import RelightMain from './RelightMain.vue'
import RelightPanel from './RelightPanel.vue'
import RelightRun from './RelightRun.vue'
import RelightSummary from './RelightSummary.vue'
import RelightTrays from './RelightTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const relight = useRelight(locale)
const { image, phase } = relight
const result = ref<EditorView>('compare')
const panel = computed(() => layout !== 'e')
reportStudioBusy(() => phase.value.kind === 'running')

const panelLabels = {
  label: lc('relight.panel', locale),
  expand: lc('relight.panel.expand', locale),
  collapse: lc('relight.panel.collapse', locale)
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
      <RelightSummary :relight :locale />
    </template>
    <template v-if="panel && image" #panel-footer>
      <RelightRun :relight :locale block />
    </template>
  </AppEditorShell>
</template>
