<script setup lang="ts">
import type {
  DepthState,
  ReshootTake
} from '../../../../composables/useReshootDemo'
import type { ReshootCamera } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootTakes from './ReshootTakes.vue'
import ReshootTakeView from './ReshootTakeView.vue'
import ReshootViewport from './ReshootViewport.vue'
import { takeLabel } from './take-label'

const {
  clip,
  camera,
  depth,
  takes,
  selected,
  current,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  depth: DepthState
  takes: readonly ReshootTake[]
  selected: string
  current?: ReshootTake
  locale?: Locale
}>()

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  select: [id: string]
}>()
</script>

<template>
  <section
    :aria-label="rc('reshoot.title', locale)"
    class="flex min-h-0 flex-1 flex-col items-center gap-3"
  >
    <div
      class="relative aspect-video w-[min(100%,calc(52svh*16/9))] rounded-md ring-1 ring-transparency-white-t8"
    >
      <ReshootTakeView v-if="current" :take="current" :locale />
      <ReshootViewport
        v-else
        :clip
        :camera
        :depth
        :locale
        @aim="emit('aim', $event)"
      />
    </div>
    <p class="text-xs text-primary-warm-gray">
      {{
        current ? takeLabel(current, locale) : rc('reshoot.take.aim', locale)
      }}
    </p>
    <ReshootTakes :takes :selected :locale @select="emit('select', $event)" />
  </section>
</template>
