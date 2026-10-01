<script setup lang="ts">
import type { Relight, RelightImage } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
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

const { setup, phase, preview, selected, lit } = relight
</script>

<template>
  <div class="relative size-full">
    <RelightStage
      :image
      :lights="setup.lights"
      :scene="setup.scene"
      :selected
      :preview
      :locale
      @select="(id) => (selected = id)"
      @begin="relight.checkpoint()"
      @place="(id, x, y) => relight.place(id, x, y)"
      @nudge="(id, x, y) => relight.updateLight(id, { x, y }, `nudge:${id}`)"
    />
    <EditorBusy
      v-if="phase.kind === 'running'"
      :title="lc('relight.busy.title', locale)"
      :detail="lc('relight.busy.detail', locale, { n: lit.length })"
    />
  </div>
</template>
