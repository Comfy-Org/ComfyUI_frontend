<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { Relight, RelightImage } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorBusy from '../app-editor/EditorBusy.vue'
import RelightStage from './RelightStage.vue'

const {
  image,
  relight,
  locale = 'en'
} = defineProps<{
  image: RelightImage
  relight: Relight
  locale?: Locale
}>()

const { setup, phase, view, handles, selected, lit } = relight
const now = useNow({ interval: 1000 })
const elapsed = computed(() =>
  phase.value.kind === 'running'
    ? elapsedLabel(now.value.getTime() - phase.value.startedAt)
    : ''
)
</script>

<template>
  <div class="relative size-full">
    <RelightStage
      :image
      :lights="setup.lights"
      :masks="setup.masks"
      :scene="setup.scene"
      :selected
      :view
      :handles
      :locale
      @select="(id) => (selected = id)"
      @begin="relight.checkpoint()"
      @place="(id, x, y) => relight.place(id, x, y)"
      @nudge="(id, x, y) => relight.updateLight(id, { x, y }, `nudge:${id}`)"
    />
    <EditorBusy
      v-if="phase.kind === 'running'"
      :title="lc('relight.busy.title', locale)"
      :detail="
        lc('relight.busy.detail', locale, { n: lit.length, time: elapsed })
      "
      :cancel-label="lc('relight.cancel', locale)"
      @cancel="relight.cancel"
    />
  </div>
</template>
