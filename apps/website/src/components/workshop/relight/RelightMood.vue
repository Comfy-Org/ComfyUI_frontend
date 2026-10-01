<script setup lang="ts">
import { computed } from 'vue'

import { useMoodThumbnails } from '../../../composables/useMoodThumbnails'
import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { MoodId } from '../../../lib/workshop/relight/lights'
import {
  MOOD_IDS,
  MOOD_LABELS,
  moodLights
} from '../../../lib/workshop/relight/lights'
import EditorTiles from '../app-editor/EditorTiles.vue'
import RelightPreview from './RelightPreview.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { image, setup } = relight
const thumbnails = useMoodThumbnails(
  () => image.value?.url,
  () => setup.value.scene
)
const options = MOOD_IDS.map((id) => ({
  id,
  label: lc(MOOD_LABELS[id], locale)
}))
const mood = computed({
  get: () => setup.value.mood,
  set: (next?: MoodId) => next && relight.pickMood(next)
})
</script>

<template>
  <EditorTiles v-model="mood" :label="lc('relight.mood', locale)" :options>
    <template #tile="{ option }">
      <img
        v-if="thumbnails[option.id]"
        :src="thumbnails[option.id]"
        alt=""
        class="size-full object-cover"
      />
      <template v-else-if="image">
        <img :src="image.url" alt="" class="size-full object-cover" />
        <RelightPreview
          :lights="moodLights(option.id, String)"
          :scene="setup.scene"
        />
      </template>
    </template>
  </EditorTiles>
</template>
