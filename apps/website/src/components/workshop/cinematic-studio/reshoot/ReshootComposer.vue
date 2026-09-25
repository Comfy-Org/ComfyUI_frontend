<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DepthState } from '../../../../composables/useReshootDemo'
import type {
  ReshootAspect,
  ReshootCamera,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import type { ReshootPopover } from './popover'
import ReshootAction from './ReshootAction.vue'
import ReshootAimChips from './ReshootAimChips.vue'
import ReshootStepper from './ReshootStepper.vue'

const {
  clip,
  camera,
  keyCount,
  aspect,
  size,
  depth,
  step,
  rendering,
  openPopover,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  keyCount: number
  aspect: ReshootAspect
  size: ReshootSize
  depth: DepthState
  step: 1 | 2
  rendering: boolean
  openPopover?: ReshootPopover
  locale?: Locale
}>()

const emit = defineEmits<{
  open: [key: ReshootPopover]
  go: [step: 1 | 2]
  prepare: []
  generate: []
  cancel: []
}>()

const prompt = defineModel<string>('prompt', { required: true })

const aspectLabel = computed(() =>
  aspect === 'source' ? rc('reshoot.aspect.source', locale) : aspect
)

const chipClass = (key: ReshootPopover) =>
  cn(
    'flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] whitespace-nowrap text-primary-comfy-canvas ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white',
    openPopover === key &&
      'bg-transparency-white-t8 text-primary-warm-white ring-transparency-white-t20'
  )
</script>

<template>
  <div
    class="flex w-full flex-col overflow-hidden rounded-3xl border border-transparency-white-t8 bg-primary-comfy-ink-light shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
    role="group"
    :aria-label="rc('reshoot.composer', locale)"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-transparency-white-t8 px-3 py-2"
    >
      <ReshootStepper
        class="sm:max-w-md"
        :step
        :can-aim="depth === 'ready'"
        :locale
        @go="emit('go', $event)"
      />
      <p class="text-xs text-primary-warm-gray max-md:hidden">
        {{
          rc(step === 1 ? 'reshoot.step1.hint' : 'reshoot.step2.hint', locale)
        }}
      </p>
    </div>

    <div v-if="step === 1" class="flex items-start gap-2.5 px-4 pt-3.5 pb-3">
      <button
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="openPopover === 'clip'"
        :aria-label="rc('reshoot.section.video', locale)"
        :class="
          cn(
            'size-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-transparency-white-t20',
            openPopover === 'clip' && 'ring-primary-warm-white'
          )
        "
        @click="emit('open', 'clip')"
      >
        <video
          :src="clip"
          muted
          playsinline
          preload="metadata"
          class="size-full object-cover"
        />
      </button>
      <label for="reshoot-prompt" class="sr-only">
        {{ rc('reshoot.section.prompt', locale) }}
      </label>
      <textarea
        id="reshoot-prompt"
        v-model="prompt"
        rows="2"
        :placeholder="rc('reshoot.prompt.placeholder', locale)"
        class="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent pt-1.5 text-base/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <div
        class="-mx-1 scrollbar-hide flex min-w-0 flex-1 basis-full items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:basis-auto"
      >
        <button
          v-if="step === 1"
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'clip'"
          :aria-label="`${rc('reshoot.section.format', locale)}: ${aspectLabel}, ${size}`"
          :class="cn(chipClass('clip'), 'gap-0 px-0')"
          @click="emit('open', 'clip')"
        >
          <span class="px-3">{{ aspectLabel }}</span>
          <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
          <span class="px-3">{{ size }}</span>
        </button>
        <ReshootAimChips
          v-else
          :clip
          :camera
          :key-count="keyCount"
          :open-popover="openPopover"
          :locale
          @open="emit('open', $event)"
          @back="emit('go', 1)"
        />
      </div>
      <ReshootAction
        :step
        :depth
        :rendering
        :locale
        class="ml-auto"
        @prepare="emit('prepare')"
        @generate="emit('generate')"
        @cancel="emit('cancel')"
      />
    </div>
  </div>
</template>
