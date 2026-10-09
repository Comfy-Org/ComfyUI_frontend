<script setup lang="ts">
import { computed, ref } from 'vue'

import type { MoveView } from '@/composables/useMoveAnything'
import { useMoveAnything } from '@/composables/useMoveAnything'
import { useResultDownload } from '@/composables/useResultDownload'
import { reportStudioBusy } from '@/composables/useStudioSwitchGuard'
import type { Locale } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { mc } from '@/lib/workshop/move-anything/copy'
import AppEditorShell from '@/components/workshop/app-editor/AppEditorShell.vue'
import EditorAlert from '@/components/workshop/app-editor/EditorAlert.vue'
import MoveAnythingDocks from './MoveAnythingDocks.vue'
import MoveAnythingHistory from './MoveAnythingHistory.vue'
import MoveAnythingMain from './MoveAnythingMain.vue'
import MoveAnythingPanel from './MoveAnythingPanel.vue'
import MoveAnythingRun from './MoveAnythingRun.vue'
import MoveAnythingSummary from './MoveAnythingSummary.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const move = useMoveAnything(locale)
const { image, phase } = move
const view = ref<MoveView>('compare')
const panel = computed(() => layout !== 'e')
const download = useResultDownload(
  phase,
  () => image.value && `moved-${image.value.name}`
)
reportStudioBusy(() => phase.value.kind === 'moving')

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
    :download
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
    </template>
    <template #dock>
      <MoveAnythingDocks v-model:view="view" :move :panel :locale />
    </template>
    <template v-if="phase.kind !== 'done'" #history>
      <MoveAnythingHistory :move :locale />
    </template>
    <template v-if="panel && image" #panel>
      <MoveAnythingPanel :image :move :locale />
    </template>
    <template v-if="panel && image" #panel-peek>
      <MoveAnythingSummary :move :locale />
    </template>
    <template v-if="panel && image" #panel-footer>
      <MoveAnythingRun :move :locale block />
    </template>
  </AppEditorShell>
</template>
