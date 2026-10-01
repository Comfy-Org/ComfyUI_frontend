<script setup lang="ts">
import { computed, ref } from 'vue'

import { useRelight } from '../../../composables/useRelight'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { Locale } from '../../../i18n/translations'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import { lc } from '../../../lib/workshop/relight/copy'
import { RELIGHT_EXAMPLE } from '../../../lib/workshop/relight/mock-run'
import AppEditorShell from '../app-editor/AppEditorShell.vue'
import EditorAlert from '../app-editor/EditorAlert.vue'
import EditorEmpty from '../app-editor/EditorEmpty.vue'
import EditorHistory from '../app-editor/EditorHistory.vue'
import EditorResult from '../app-editor/EditorResult.vue'
import EditorResultDock from '../app-editor/EditorResultDock.vue'
import type { EditorView } from '../app-editor/view'
import RelightDock from './RelightDock.vue'
import RelightPanel from './RelightPanel.vue'
import RelightRun from './RelightRun.vue'
import RelightTrays from './RelightTrays.vue'
import RelightViewMenu from './RelightViewMenu.vue'
import RelightWorkspace from './RelightWorkspace.vue'

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

const resultLabels = computed(() => ({
  resultAlt: lc('relight.alt.result', locale),
  originalAlt:
    image.value?.url === RELIGHT_EXAMPLE.url
      ? lc('relight.alt.example', locale)
      : (image.value?.name ?? ''),
  original: lc('relight.view.original', locale),
  result: lc('relight.view.result', locale),
  slider: lc('relight.compare', locale)
}))
const dockLabels = {
  compare: lc('relight.view.compare', locale),
  result: lc('relight.view.result', locale),
  original: lc('relight.view.original', locale),
  edit: lc('relight.edit', locale),
  again: lc('relight.again', locale),
  download: lc('relight.download', locale)
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
    :panel-label="lc('relight.panel', locale)"
    :repo="workshopAppRepo('relight')"
    :locale
    data-testid="relight"
    :show-dock="Boolean(image) && (!panel || phase.kind === 'done')"
  >
    <EditorEmpty
      v-if="!image"
      :title="lc('relight.empty.title', locale)"
      :meta="lc('relight.empty.meta', locale)"
      :upload-label="lc('relight.empty.upload', locale)"
      :example-label="lc('relight.empty.example', locale)"
      :example-image="RELIGHT_EXAMPLE.url"
      data-testid="relight-empty"
      @file="relight.useFile"
      @example="relight.useExample"
    />
    <EditorResult
      v-else-if="phase.kind === 'done'"
      :before="image.url"
      :after="phase.result.url"
      :view="result"
      :width="image.width"
      :height="image.height"
      :labels="resultLabels"
    />
    <RelightWorkspace v-else :image :relight :locale />
    <template v-if="editing" #start>
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
      <EditorResultDock
        v-if="image && phase.kind === 'done'"
        v-model:view="result"
        :href="phase.result.url"
        :file-name="`relit-${image.name}`"
        :labels="dockLabels"
        @edit="relight.edit"
        @again="relight.relight"
      />
      <RelightDock v-else-if="!panel" :relight :locale />
    </template>
    <template v-if="panel && image" #panel>
      <RelightPanel :relight :locale />
    </template>
    <template v-if="panel && image" #panel-footer>
      <RelightRun :relight :locale block />
    </template>
  </AppEditorShell>
</template>
