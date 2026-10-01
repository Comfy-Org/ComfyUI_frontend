<script setup lang="ts">
import { computed } from 'vue'

import { useSpriteSheet } from '../../../composables/useSpriteSheet'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { spc } from '../../../lib/workshop/sprite-sheet/copy'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import SpriteSheetDocks from './SpriteSheetDocks.vue'
import SpriteSheetMain from './SpriteSheetMain.vue'
import SpriteSheetPanel from './SpriteSheetPanel.vue'
import SpriteSheetRun from './SpriteSheetRun.vue'
import SpriteSheetSummary from './SpriteSheetSummary.vue'
import SpriteSheetTrays from './SpriteSheetTrays.vue'

const { locale = 'en', layout = 'd' } = defineProps<{
  locale?: Locale
  /** The review menu's layout: `e` keeps the bottom dock, else a side panel. */
  layout?: string
}>()

const sprite = useSpriteSheet()
const { image, phase } = sprite
const panel = computed(() => layout !== 'e')
reportStudioBusy(() => phase.value.kind === 'running')

const panelLabels = {
  label: spc('sprite.panel', locale),
  expand: spc('sprite.panel.expand', locale),
  collapse: spc('sprite.panel.collapse', locale)
}
</script>

<template>
  <AppEditorShell
    :title="spc('sprite.title', locale)"
    :tools-label="spc('sprite.tools', locale)"
    :panel-labels="panelLabels"
    :panel-dimmed="phase.kind === 'done'"
    :repo="workshopAppRepo('sprite-sheet')"
    :locale
    data-testid="sprite-sheet"
    :show-dock="Boolean(image)"
  >
    <SpriteSheetMain :sprite :locale />
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ spc('sprite.failed', locale) }}
      </EditorAlert>
      <SpriteSheetTrays v-if="!panel" :sprite :locale />
    </template>
    <template #dock>
      <SpriteSheetDocks :sprite :panel :locale />
    </template>
    <template v-if="panel && image" #panel>
      <SpriteSheetPanel :sprite :locale />
    </template>
    <template v-if="panel && image" #panel-peek>
      <SpriteSheetSummary :sprite :locale />
    </template>
    <template v-if="panel && image" #panel-footer>
      <SpriteSheetRun :sprite :locale block />
    </template>
  </AppEditorShell>
</template>
