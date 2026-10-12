<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed } from 'vue'

import { usePaparazziMe } from '@/composables/usePaparazziMe'
import { useResultDownload } from '@/composables/useResultDownload'
import { reportStudioBusy } from '@/composables/useStudioSwitchGuard'
import type { Locale } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import AppEditorShell from '@/components/workshop/app-editor/AppEditorShell.vue'
import EditorAlert from '@/components/workshop/app-editor/EditorAlert.vue'
import EditorPicker from '@/components/workshop/app-editor/EditorPicker.vue'
import { useImagePaste } from '@/components/workshop/app-editor/useImagePaste'
import PaparazziDocks from './PaparazziDocks.vue'
import PaparazziHistory from './PaparazziHistory.vue'
import PaparazziMain from './PaparazziMain.vue'
import PaparazziPanel from './PaparazziPanel.vue'
import PaparazziRun from './PaparazziRun.vue'
import PaparazziSceneGrid from './PaparazziSceneGrid.vue'
import PaparazziSummary from './PaparazziSummary.vue'
import PaparazziTrays from './PaparazziTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()
const { t } = translationsFor(locale)

const paparazzi = usePaparazziMe()
const { phase, pickerOpen } = paparazzi
const panel = computed(() => layout !== 'e')
const download = useResultDownload(
  phase,
  ({ result }) => `paparazzi-me-${result.seed}.jpg`
)
reportStudioBusy(() => phase.value.kind === 'running')

useImagePaste(paparazzi.useFaceFile, () => phase.value.kind !== 'running')

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
    :download
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
      <EditorPicker
        v-if="panel && pickerOpen"
        :title="pc('paparazzi.scene.pick', locale)"
        :close-label="t('cinematic.picker.close')"
        @close="paparazzi.closePicker"
      >
        <PaparazziSceneGrid
          :paparazzi
          :locale
          @picked="paparazzi.closePicker"
        />
      </EditorPicker>
    </template>
    <template #dock>
      <PaparazziDocks :paparazzi :panel :locale />
    </template>
    <template #history>
      <PaparazziHistory :paparazzi :locale />
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
