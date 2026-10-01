<script setup lang="ts">
import { Plus, SunDim } from '@lucide/vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import { MOOD_LABELS } from '../../../lib/workshop/relight/lights'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'
import RelightDots from './RelightDots.vue'
import RelightRun from './RelightRun.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup, tray, phase, full } = relight
</script>

<template>
  <EditorTool
    :icon="Plus"
    :label="lc('relight.tool.add', locale)"
    :disabled="phase.kind === 'running' || full"
    @click="relight.addLight()"
  />
  <EditorDivider />
  <EditorChip
    :label="lc('relight.lights', locale)"
    :value="String(setup.lights.length)"
    :expanded="tray === 'lights'"
    :disabled="phase.kind === 'running'"
    compact
    @click="relight.toggleTray('lights')"
  >
    <RelightDots :colors="setup.lights.map((light) => light.color)" />
  </EditorChip>
  <EditorChip
    :label="lc('relight.scene', locale)"
    :value="lc(MOOD_LABELS[setup.mood], locale)"
    :expanded="tray === 'scene'"
    :disabled="phase.kind === 'running'"
    compact
    @click="relight.toggleTray('scene')"
  >
    <SunDim
      class="-ml-0.5 size-3.5 text-primary-warm-gray"
      aria-hidden="true"
    />
  </EditorChip>
  <EditorChip
    :label="lc('relight.masks', locale)"
    :value="String(setup.masks.length)"
    :expanded="tray === 'masks'"
    :disabled="phase.kind === 'running'"
    compact
    @click="relight.toggleTray('masks')"
  />
  <EditorChip
    :label="lc('relight.generation', locale)"
    :value="
      lc('relight.generation.value', locale, { n: setup.generation.strength })
    "
    :expanded="tray === 'generation'"
    :disabled="phase.kind === 'running'"
    compact
    @click="relight.toggleTray('generation')"
  />
  <EditorDivider class="max-sm:hidden" />
  <RelightRun :relight :locale />
</template>
