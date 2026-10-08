<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StageCompare, SwapTake } from '@/lib/workshop/openjutsu/take'
import OpenjutsuCompareToggle from './OpenjutsuCompareToggle.vue'
import OpenjutsuTakeActions from './OpenjutsuTakeActions.vue'

/** Everything under the player for a finished take. */
const {
  take,
  url,
  sample,
  locale = 'en'
} = defineProps<{
  take: SwapTake
  /** The take's result. */
  url: string
  /** The stand-in backend is answering, so results are not real. */
  sample: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ reuse: [id: string] }>()

const compare = defineModel<StageCompare>('compare', { required: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="sample"
      class="rounded-xl bg-transparency-white-t8 px-3 py-2 text-xs/relaxed text-primary-warm-white"
      data-testid="openjutsu-sample-note"
    >
      {{ t('openjutsu.sample.result') }}
    </p>
    <div class="flex w-full flex-wrap items-center justify-between gap-2">
      <OpenjutsuCompareToggle v-model="compare" :locale />
      <OpenjutsuTakeActions
        :url
        :file-name="`openjutsu-take-${take.n}.mp4`"
        :locale
        @reuse="emit('reuse', take.id)"
      />
    </div>
    <p class="text-xs/relaxed text-primary-warm-gray">
      {{ t('openjutsu.take.detail', { target: take.target }) }}
      · {{ t('openjutsu.take.audio') }}
    </p>
  </div>
</template>
