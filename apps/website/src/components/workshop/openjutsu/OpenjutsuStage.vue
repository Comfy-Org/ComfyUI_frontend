<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { SwapWindow } from '@/lib/workshop/openjutsu/clip'
import type { StageCompare, SwapTake } from '@/lib/workshop/openjutsu/take'
import {
  loopWindow,
  stagePanel,
  stageSource
} from '@/lib/workshop/openjutsu/take'
import OpenjutsuEmptyStage from './OpenjutsuEmptyStage.vue'
import OpenjutsuPartSummary from './OpenjutsuPartSummary.vue'
import OpenjutsuPlayer from './OpenjutsuPlayer.vue'
import OpenjutsuResult from './OpenjutsuResult.vue'
import OpenjutsuTakeStatus from './OpenjutsuTakeStatus.vue'
import OpenjutsuTakes from './OpenjutsuTakes.vue'

/**
 * The right-hand side of the app: the player, what sits under it for the clip
 * or the take on show, and the strip of takes. It holds no run state; the one
 * thing it remembers is which of a take's two videos is showing.
 */
const {
  videoUrl,
  clipSeconds,
  range,
  partSeconds,
  takes,
  selected,
  current,
  rendering,
  sample,
  locale = 'en'
} = defineProps<{
  videoUrl?: string
  clipSeconds?: number
  range?: SwapWindow
  partSeconds?: number
  takes: readonly SwapTake[]
  selected: string
  current?: SwapTake
  rendering: boolean
  /** The stand-in backend is answering, so results are not real. */
  sample: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  trim: []
  cancel: []
  reuse: [id: string]
}>()

/** A finished take can be flipped back to the clip it was made from. */
const compare = ref<StageCompare>('result')
watch(
  () => selected,
  () => (compare.value = 'result')
)

const view = computed(() => ({
  current,
  compare: compare.value,
  videoUrl,
  range,
  partSeconds,
  clipSeconds
}))
const part = computed(() => loopWindow(view.value))
const panel = computed(() => stagePanel(view.value))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4" data-testid="openjutsu-stage">
    <OpenjutsuEmptyStage v-if="!videoUrl" :locale />
    <template v-else>
      <OpenjutsuPlayer :src="stageSource(view)" :part>
        <OpenjutsuTakeStatus
          :take="current"
          :locale
          @cancel="emit('cancel')"
          @retry="emit('reuse', $event)"
        />
      </OpenjutsuPlayer>
      <OpenjutsuPartSummary
        v-if="panel === 'part' && part && clipSeconds !== undefined"
        :part
        :clip-seconds="clipSeconds"
        :locale
        @trim="emit('trim')"
      />
      <OpenjutsuResult
        v-else-if="panel === 'result' && current?.url"
        v-model:compare="compare"
        :take="current"
        :url="current.url"
        :sample
        :locale
        @reuse="emit('reuse', $event)"
      />
      <OpenjutsuTakes
        v-if="takes.length"
        :takes
        :selected
        :rendering
        :locale
        @select="emit('select', $event)"
      />
    </template>
  </div>
</template>
