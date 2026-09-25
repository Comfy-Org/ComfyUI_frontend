<script setup lang="ts">
import type { DepthState } from '../../../../composables/useReshootDemo'
import type {
  CameraKey,
  ReshootAspect,
  ReshootCamera,
  ReshootMotion,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootAction from './ReshootAction.vue'
import ReshootAimSections from './ReshootAimSections.vue'
import ReshootPrepareSections from './ReshootPrepareSections.vue'
import ReshootStepper from './ReshootStepper.vue'

const {
  clip,
  clipName,
  isExample,
  camera,
  keys,
  depth,
  step,
  rendering,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  isExample: boolean
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  depth: DepthState
  step: 1 | 2
  rendering: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  go: [step: 1 | 2]
  aim: [patch: Partial<ReshootCamera>]
  key: []
  removeKey: [frame: number]
  clearKeys: []
  prepare: []
  generate: []
  cancel: []
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })
const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const motion = defineModel<ReshootMotion>('motion', { required: true })
const prompt = defineModel<string>('prompt', { required: true })
</script>

<template>
  <aside
    :aria-label="rc('reshoot.panel', locale)"
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
  >
    <header
      class="flex flex-col gap-2 border-b border-transparency-white-t8 px-3 py-3"
    >
      <ReshootStepper
        :step
        :can-aim="depth === 'ready'"
        :locale
        @go="emit('go', $event)"
      />
      <p class="px-2 text-xs/relaxed text-primary-warm-gray">
        {{
          rc(step === 1 ? 'reshoot.step1.hint' : 'reshoot.step2.hint', locale)
        }}
      </p>
    </header>
    <div class="flex flex-col divide-y divide-transparency-white-t8">
      <ReshootPrepareSections
        v-if="step === 1"
        v-model:upload="upload"
        v-model:aspect="aspect"
        v-model:size="size"
        v-model:prompt="prompt"
        :clip
        :clip-name="clipName"
        :is-example="isExample"
        :locale
      />
      <ReshootAimSections
        v-else
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        v-model:motion="motion"
        :clip
        :clip-name="clipName"
        :aspect
        :size
        :prompt
        :camera
        :keys
        :locale
        @back="emit('go', 1)"
        @aim="emit('aim', $event)"
        @key="emit('key')"
        @remove-key="emit('removeKey', $event)"
        @clear-keys="emit('clearKeys')"
      />
    </div>
    <footer
      class="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 bg-page/85 p-3 backdrop-blur-sm"
    >
      <ReshootAction
        :step
        :depth
        :rendering
        wide
        :locale
        @prepare="emit('prepare')"
        @generate="emit('generate')"
        @cancel="emit('cancel')"
      />
      <p class="text-center text-[11px] text-primary-warm-gray">
        {{ rc('reshoot.demoNote', locale) }}
      </p>
    </footer>
  </aside>
</template>
