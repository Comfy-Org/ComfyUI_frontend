<script setup lang="ts">
import { computed } from 'vue'

import type { Reel } from '../../../lib/workshop/cinematic-studio/reel'
import {
  selectedTake,
  takesOfShot
} from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicSequence from './CinematicSequence.vue'
import CinematicTakeBar from './CinematicTakeBar.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

const {
  reel,
  modelName,
  locale = 'en'
} = defineProps<{
  reel: Reel
  modelName: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

const current = computed(() => selectedTake(reel))
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
</script>

<template>
  <section
    class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    :aria-label="tc('cinematic.stage.label', locale)"
  >
    <header
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.output.title', locale) }}
    </header>
    <div
      class="flex min-h-72 flex-col items-center justify-center gap-4 p-4 sm:p-6 lg:min-h-112"
    >
      <template v-if="current">
        <CinematicTakeFrame :current :locale />
        <CinematicTakeBar
          :current
          :siblings
          :model-name="modelName"
          :locale
          @select="emit('select', $event)"
        />
      </template>

      <div v-else class="flex flex-col items-center gap-2 text-center">
        <p class="text-base font-semibold text-primary-warm-white">
          {{ tc('cinematic.stage.emptyTitle', locale) }}
        </p>
        <p class="text-sm text-primary-warm-gray">
          {{ tc('cinematic.stage.emptyBody', locale) }}
        </p>
      </div>
    </div>
    <CinematicSequence
      v-if="reel.takes.length"
      :takes="reel.takes"
      :current-id="current?.id"
      :locale
      @select="emit('select', $event)"
    />
  </section>
</template>
