<script setup lang="ts">
import { computed } from 'vue'

import { useHandProductSwap } from '../../../composables/useHandProductSwap'
import { useResultDownload } from '../../../composables/useResultDownload'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { hc } from '../../../lib/workshop/hand-product-swap/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import HandSwapDocks from './HandSwapDocks.vue'
import HandSwapHistory from './HandSwapHistory.vue'
import HandSwapMain from './HandSwapMain.vue'
import HandSwapPanel from './HandSwapPanel.vue'
import HandSwapRun from './HandSwapRun.vue'
import HandSwapSummary from './HandSwapSummary.vue'
import HandSwapTrays from './HandSwapTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const swap = useHandProductSwap(locale)
const { hand, phase } = swap
const panel = computed(() => layout !== 'e')
const download = useResultDownload(
  phase,
  () => hand.value && `swapped-${hand.value.name}`
)
reportStudioBusy(() => phase.value.kind === 'running')

const panelLabels = {
  label: hc('swap.panel', locale),
  expand: hc('swap.panel.expand', locale),
  collapse: hc('swap.panel.collapse', locale)
}
</script>

<template>
  <AppEditorShell
    :title="hc('swap.title', locale)"
    :tools-label="hc('swap.tools', locale)"
    :panel-labels="panelLabels"
    :panel-dimmed="phase.kind === 'done'"
    :download
    :repo="workshopAppRepo('hand-product-swap')"
    :locale
    data-testid="hand-product-swap"
    :show-dock="Boolean(hand)"
  >
    <HandSwapMain :swap :locale />
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ hc('swap.failed', locale) }}
      </EditorAlert>
      <HandSwapTrays v-if="!panel" :swap :locale />
    </template>
    <template #dock>
      <HandSwapDocks :swap :panel :locale />
    </template>
    <template v-if="phase.kind !== 'done'" #history>
      <HandSwapHistory :swap :locale />
    </template>
    <template v-if="panel && hand" #panel>
      <HandSwapPanel :hand :swap :locale />
    </template>
    <template v-if="panel && hand" #panel-peek>
      <HandSwapSummary :swap :locale />
    </template>
    <template v-if="panel && hand" #panel-footer>
      <HandSwapRun :swap :locale block />
    </template>
  </AppEditorShell>
</template>
