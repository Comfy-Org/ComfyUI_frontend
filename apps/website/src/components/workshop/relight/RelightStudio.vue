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
import EditorHint from '../app-editor/EditorHint.vue'
import EditorResult from '../app-editor/EditorResult.vue'
import EditorResultDock from '../app-editor/EditorResultDock.vue'
import type { EditorView } from '../app-editor/view'
import RelightDock from './RelightDock.vue'
import RelightTrays from './RelightTrays.vue'
import RelightWorkspace from './RelightWorkspace.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const relight = useRelight(locale)
const { image, setup, phase, tray, preview } = relight
const view = ref<EditorView>('compare')
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
</script>

<template>
  <AppEditorShell
    :title="lc('relight.title', locale)"
    :tools-label="lc('relight.tools', locale)"
    :repo="workshopAppRepo('relight')"
    :locale
    data-testid="relight"
    :show-dock="Boolean(image)"
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
      :view
      :width="image.width"
      :height="image.height"
      :labels="resultLabels"
    />
    <RelightWorkspace v-else :image :relight :locale />
    <template #overlay>
      <EditorHint
        v-if="image && phase.kind === 'editing'"
        :text="lc('relight.hint', locale)"
      />
    </template>
    <template #tray>
      <EditorAlert v-if="phase.kind === 'failed'">
        {{ lc('relight.failed', locale) }}
      </EditorAlert>
      <RelightTrays :relight :locale />
    </template>
    <template #dock>
      <EditorResultDock
        v-if="image && phase.kind === 'done'"
        v-model:view="view"
        :href="phase.result.url"
        :file-name="`relit-${image.name}`"
        :labels="dockLabels"
        @edit="relight.edit"
        @again="relight.relight"
      />
      <RelightDock
        v-else
        v-model:preview="preview"
        :lights="setup.lights"
        :mood="setup.mood"
        :scene="setup.scene"
        :tray
        :full="relight.full.value"
        :can-undo="relight.canUndo.value"
        :can-redo="relight.canRedo.value"
        :can-run="relight.canRun.value"
        :running="phase.kind === 'running'"
        :locale
        @add="relight.addLight"
        @undo="relight.undo"
        @redo="relight.redo"
        @tray="relight.toggleTray"
        @run="relight.relight"
        @cancel="relight.cancel"
      />
    </template>
  </AppEditorShell>
</template>
