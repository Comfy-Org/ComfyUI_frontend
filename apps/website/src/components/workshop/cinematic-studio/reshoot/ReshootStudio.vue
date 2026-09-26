<script setup lang="ts">
import { Clapperboard } from '@lucide/vue'

import { useCinematicLeaveGuard } from '../../../../composables/useCinematicLeaveGuard'
import { useReshoot } from '../../../../composables/useReshoot'
import { reportStudioBusy } from '../../../../composables/useStudioSwitchGuard'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import RunLeaveDialog from '../../RunLeaveDialog.vue'
import AppsBackLink from '../AppsBackLink.vue'
import ReshootHeader from './ReshootHeader.vue'
import ReshootExamples from './ReshootExamples.vue'
import ReshootSide from './ReshootSide.vue'
import ReshootStage from './ReshootStage.vue'
import ReshootUpload from './ReshootUpload.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reshoot = useReshoot({ locale })
const {
  upload,
  clip,
  clipName,
  isExample,
  picked,
  aspect,
  size,
  depth,
  stage,
  notice,
  frames,
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
  current,
  gate,
  canGenerate,
  priceNote,
  session
} = reshoot

reportStudioBusy(() => reshoot.rendering.value)
const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => reshoot.rendering.value,
  () => reshoot.cancel()
)
</script>

<template>
  <div
    class="mx-auto mb-12 flex w-full max-w-10xl flex-col gap-4 px-4 pt-6 sm:px-8 lg:mb-20 lg:px-14"
    data-testid="reshoot"
  >
    <AppsBackLink :locale />
    <ReshootHeader :locale class="mb-4" />
    <div class="grid items-start gap-6 lg:grid-cols-[27rem_minmax(0,1fr)]">
      <ReshootUpload v-if="!picked" :locale @pick="reshoot.pick" />
      <ReshootSide
        v-else
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
        :frames
        :gate
        :can-generate="canGenerate"
        :price-note="priceNote"
        :workspace-name="session?.workspace.name"
        :locale
        @aim="reshoot.aim"
        @key="reshoot.addKey"
        @remove-key="reshoot.removeKey"
        @clear-keys="keys = []"
        @generate="reshoot.generate"
      />
      <div
        v-if="!picked"
        class="mx-auto flex aspect-video w-[min(100%,calc(52svh*16/9))] flex-col items-center justify-center gap-2 rounded-md bg-transparency-white-t4 px-6 text-center ring-1 ring-transparency-white-t8 lg:mt-2"
        data-testid="reshoot-empty"
      >
        <Clapperboard
          class="size-8 text-primary-warm-gray"
          aria-hidden="true"
        />
        <p class="text-base text-primary-comfy-canvas">
          {{ rc('reshoot.empty.title', locale) }}
        </p>
        <p class="text-xs text-primary-warm-gray">
          {{ rc('reshoot.empty.hint', locale) }}
        </p>
      </div>
      <ReshootStage
        v-else
        :clip
        :camera
        :depth
        :stage
        :notice
        :step
        :takes
        :selected
        :current
        cancellable
        :locale
        class="lg:pt-2"
        @aim="reshoot.aim"
        @select="selected = $event"
        @cancel="reshoot.cancel"
        @reuse="reshoot.reuse(selected)"
      />
    </div>
    <ReshootExamples
      :active-id="picked && isExample ? 'crossview-example' : undefined"
      :locale
      class="mt-6"
      @pick="reshoot.pick()"
    />
    <RunLeaveDialog
      :open="leavingTo !== undefined"
      :locale
      @update:open="(value: boolean) => !value && stay()"
      @leave="leave"
    />
  </div>
</template>
