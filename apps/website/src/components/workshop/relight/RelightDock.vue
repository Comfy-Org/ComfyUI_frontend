<script setup lang="ts">
import { Plus } from '@lucide/vue'

import type { Relight, RelightTray } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import { MOOD_LABELS } from '../../../lib/workshop/relight/lights'
import EditorChip from '../app-editor/EditorChip.vue'
import EditorDivider from '../app-editor/EditorDivider.vue'
import EditorTool from '../app-editor/EditorTool.vue'
import RelightRun from './RelightRun.vue'
import { sectionMeta } from './sections'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup, tray, phase, full } = relight

function chips(): { id: RelightTray; label: string; value: string }[] {
  return [
    {
      id: 'mood',
      label: lc('relight.mood', locale),
      value: lc(MOOD_LABELS[setup.value.mood], locale)
    },
    {
      id: 'lights',
      label: lc('relight.lights', locale),
      value: String(setup.value.lights.length)
    },
    {
      id: 'shadows',
      label: lc('relight.shadows', locale),
      value: sectionMeta('shadows', relight, locale) ?? ''
    },
    {
      id: 'masks',
      label: lc('relight.masks', locale),
      value: String(setup.value.masks.length)
    },
    {
      id: 'generation',
      label: lc('relight.generation', locale),
      value: lc('relight.generation.value', locale, {
        n: setup.value.generation.strength
      })
    }
  ]
}
</script>

<template>
  <EditorTool
    :icon="Plus"
    :label="lc('relight.tool.add', locale)"
    icon-only
    :disabled="phase.kind === 'running' || full"
    @click="relight.addLight()"
  />
  <EditorDivider />
  <EditorChip
    v-for="chip in chips()"
    :key="chip.id"
    :label="chip.label"
    :value="chip.value"
    :expanded="tray === chip.id"
    :disabled="phase.kind === 'running'"
    compact
    @click="relight.toggleTray(chip.id)"
  />
  <EditorDivider class="max-sm:hidden" />
  <RelightRun :relight :locale />
</template>
