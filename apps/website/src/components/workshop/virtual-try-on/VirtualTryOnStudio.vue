<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'

import { useResultDownload } from '../../../composables/useResultDownload'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import { useVirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import { imageFileOf } from '../../../lib/workshop/virtual-try-on/image-transfer'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import VirtualTryOnDocks from './VirtualTryOnDocks.vue'
import VirtualTryOnHistory from './VirtualTryOnHistory.vue'
import VirtualTryOnMain from './VirtualTryOnMain.vue'
import VirtualTryOnPanel from './VirtualTryOnPanel.vue'
import VirtualTryOnRun from './VirtualTryOnRun.vue'
import VirtualTryOnSummary from './VirtualTryOnSummary.vue'
import VirtualTryOnTrays from './VirtualTryOnTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const tryOn = useVirtualTryOn(locale)
const { phase, person } = tryOn
const panel = computed(() => layout !== 'e')
const download = useResultDownload(phase, () => `try-on-${person.value.name}`)
reportStudioBusy(() => phase.value.kind === 'running')
useEventListener('paste', (event: ClipboardEvent) => {
  const file = imageFileOf(event.clipboardData)
  if (!file || phase.value.kind === 'running') return
  event.preventDefault()
  tryOn.edit()
  tryOn.useGarmentFile(file)
})

const panelLabels = {
  label: vc('tryOn.panel', locale),
  expand: vc('tryOn.panel.expand', locale),
  collapse: vc('tryOn.panel.collapse', locale)
}
</script>

<template>
  <AppEditorShell
    :title="vc('tryOn.title', locale)"
    :tools-label="vc('tryOn.tools', locale)"
    :panel-labels="panelLabels"
    :panel-dimmed="phase.kind === 'done'"
    :download
    :repo="workshopAppRepo('virtual-try-on')"
    :locale
    data-testid="virtual-try-on"
  >
    <VirtualTryOnMain :try-on :locale />
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ vc('tryOn.failed', locale) }}
      </EditorAlert>
      <VirtualTryOnTrays v-if="!panel" :try-on :locale />
    </template>
    <template #dock>
      <VirtualTryOnDocks :try-on :panel :locale />
    </template>
    <template v-if="phase.kind !== 'done'" #history>
      <VirtualTryOnHistory :try-on :locale />
    </template>
    <template v-if="panel" #panel>
      <VirtualTryOnPanel :try-on :locale />
    </template>
    <template v-if="panel" #panel-peek>
      <VirtualTryOnSummary :try-on :locale />
    </template>
    <template v-if="panel" #panel-footer>
      <VirtualTryOnRun :try-on :locale block />
    </template>
  </AppEditorShell>
</template>
