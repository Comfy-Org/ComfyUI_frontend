<script setup lang="ts">
import { computed } from 'vue'

import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Reel } from '../../../lib/workshop/cinematic-studio/reel'
import {
  selectedTake,
  takesOfShot
} from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicSequence from './CinematicSequence.vue'
import CinematicTakeBar from './CinematicTakeBar.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

const {
  reel,
  models,
  locale = 'en'
} = defineProps<{
  reel: Reel
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

const current = computed(() => selectedTake(reel))
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
</script>

<template>
  <main
    class="flex min-w-0 flex-1 flex-col bg-black/25"
    :aria-label="tc('cinematic.stage.label', locale)"
  >
    <div
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-10 pt-10"
    >
      <template v-if="current">
        <CinematicTakeFrame :current :locale />
        <CinematicTakeBar
          :current
          :siblings
          :models
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
  </main>
</template>
