<script setup lang="ts">
import { computed } from 'vue'

import { useReshootDemo } from '../../../../composables/useReshootDemo'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import AppsBackLink from '../AppsBackLink.vue'
import ReshootHeader from './ReshootHeader.vue'
import ReshootPick from './ReshootPick.vue'
import ReshootSide from './ReshootSide.vue'
import ReshootStage from './ReshootStage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const demo = useReshootDemo({ autoRead: true })
const {
  upload,
  clip,
  clipName,
  isExample,
  picked,
  aspect,
  size,
  depth,
  step,
  camera,
  keepAim,
  frame,
  keys,
  motion,
  prompt,
  seed,
  takes,
  selected,
  current
} = demo

const canReuse = computed(
  () => current.value?.status === 'done' && current.value.id !== 'example'
)
</script>

<template>
  <div
    class="mx-auto mb-12 flex w-full max-w-10xl flex-col gap-4 px-4 pt-6 sm:px-8 lg:mb-20 lg:px-14"
    data-testid="reshoot"
  >
    <AppsBackLink :locale />
    <ReshootHeader :locale class="mb-4" />
    <ReshootPick v-if="!picked" :locale @pick="demo.pick" />
    <div
      v-else
      class="grid items-start gap-6 lg:grid-cols-[23rem_minmax(0,1fr)]"
    >
      <ReshootSide
        v-model:upload="upload"
        v-model:aspect="aspect"
        v-model:size="size"
        v-model:seed="seed"
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        v-model:motion="motion"
        v-model:prompt="prompt"
        :clip
        :clip-name="clipName"
        :is-example="isExample"
        :camera
        :keys
        :depth
        :can-reuse="canReuse"
        :locale
        @aim="demo.aim"
        @key="demo.addKey"
        @remove-key="demo.removeKey"
        @clear-keys="keys = []"
        @reuse="demo.reuse(selected)"
        @generate="demo.generate"
      />
      <ReshootStage
        :clip
        :camera
        :depth
        :step
        :takes
        :selected
        :current
        cancellable
        :locale
        class="lg:pt-2"
        @aim="demo.aim"
        @select="selected = $event"
        @cancel="demo.cancel"
      />
    </div>
    <p class="text-center text-[11px] text-primary-warm-gray">
      {{ rc('reshoot.demoNote', locale) }}
    </p>
  </div>
</template>
