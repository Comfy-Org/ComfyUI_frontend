<script setup lang="ts">
import { computed } from 'vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { ShadowStyle } from '../../../lib/workshop/relight/shadows'
import { SHADOW_STYLES } from '../../../lib/workshop/relight/shadows'
import EditorTiles from '../app-editor/EditorTiles.vue'
import RelightShadowThumb from './RelightShadowThumb.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const LABELS = {
  none: 'relight.shadows.none',
  soft: 'relight.shadows.soft',
  hard: 'relight.shadows.hard',
  long: 'relight.shadows.long'
} as const

const options = SHADOW_STYLES.map((id) => ({
  id,
  label: lc(LABELS[id], locale)
}))
const style = computed({
  get: () => relight.shadows.value,
  set: (next?: ShadowStyle) => next && relight.applyShadowStyle(next)
})
</script>

<template>
  <EditorTiles
    v-model="style"
    :label="lc('relight.shadows', locale)"
    :options
    :columns="4"
  >
    <template #tile="{ option }">
      <RelightShadowThumb :look="option.id" />
    </template>
  </EditorTiles>
</template>
