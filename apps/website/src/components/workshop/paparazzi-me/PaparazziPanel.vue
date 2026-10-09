<script setup lang="ts">
import { ChevronDown, Maximize } from '@lucide/vue'
import { computed } from 'vue'

import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'
import type { PaparazziMe } from '@/composables/usePaparazziMe'
import type { Locale } from '@/i18n/translations'
import { pc } from '@/lib/workshop/paparazzi-me/copy'
import { RESOLUTIONS, outputSize } from '@/lib/workshop/paparazzi-me/setup'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import PaparazziSceneRow from './PaparazziSceneRow.vue'
import PaparazziSeedField from './PaparazziSeedField.vue'
import PaparazziStar from './PaparazziStar.vue'

const { paparazzi, locale = 'en' } = defineProps<{
  paparazzi: PaparazziMe
  locale?: Locale
}>()

const { phase, face, setup } = paparazzi
const resolutions = RESOLUTIONS.map((id) => ({
  id,
  label: id,
  meta: pc('paparazzi.resolution.size', locale, outputSize(id))
}))
const resolution = computed({
  get: () => setup.value.resolution,
  set: (id: string) => {
    const picked = RESOLUTIONS.find((option) => option === id)
    if (picked) paparazzi.change({ resolution: picked })
  }
})
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="flex min-w-0 flex-col gap-3 pt-2"
    data-testid="paparazzi-panel"
  >
    <EditorSourceTile
      kind="image"
      :src="face.url"
      :name="face.name"
      :add-label="pc('paparazzi.face.tip', locale)"
      :change-label="pc('paparazzi.face.changeLabel', locale)"
      input-test-id="paparazzi-face-input"
      @file="paparazzi.useFaceFile"
    />
    <PaparazziStar :paparazzi :locale />
    <PaparazziSceneRow :paparazzi :locale />
    <div class="grid grid-cols-2 gap-2">
      <CinematicMenu
        v-model="resolution"
        :options="resolutions"
        :heading="pc('paparazzi.resolution', locale)"
        side="top"
        tooltip
        :trigger-class="FORMAT_TRIGGER_CLASS"
      >
        <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
        <span class="flex-1 text-left">{{ setup.resolution }}</span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
      </CinematicMenu>
      <PaparazziSeedField
        :model-value="setup.seed"
        :label="pc('paparazzi.seed', locale)"
        :shuffle-label="pc('paparazzi.seed.shuffle', locale)"
        @update:model-value="(seed) => paparazzi.change({ seed }, 'seed')"
      />
    </div>
  </fieldset>
</template>
