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
import { t } from '../../../../i18n/translations'
import ReshootAction from './ReshootAction.vue'
import ReshootCameraControls from './ReshootCameraControls.vue'
import ReshootClipControls from './ReshootClipControls.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'

const {
  clip,
  clipName,
  isExample,
  camera,
  keys,
  depth,
  rendering,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  isExample: boolean
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  depth: DepthState
  rendering: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  key: []
  removeKey: [frame: number]
  clearKeys: []
  analyze: []
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

const labelClass =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
</script>

<template>
  <aside
    :aria-label="rc('reshoot.panel', locale)"
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
  >
    <header
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.input.title', locale) }}
    </header>
    <div class="flex flex-col divide-y divide-transparency-white-t8">
      <section class="flex flex-col gap-2.5 p-5">
        <h2 :class="labelClass">{{ rc('reshoot.section.video', locale) }}</h2>
        <ReshootClipControls
          v-model:upload="upload"
          v-model:aspect="aspect"
          v-model:size="size"
          :clip
          :clip-name="clipName"
          :is-example="isExample"
          :locale
        />
      </section>
      <section class="flex flex-col gap-2.5 p-5">
        <h2 :class="labelClass">{{ rc('reshoot.section.camera', locale) }}</h2>
        <ReshootCameraControls
          v-model:keep-aim="keepAim"
          :camera
          :disabled="depth !== 'ready'"
          :locale
          @aim="emit('aim', $event)"
        />
      </section>
      <section class="flex flex-col gap-2.5 p-5">
        <h2 :class="labelClass">{{ rc('reshoot.section.move', locale) }}</h2>
        <ReshootMoveControls
          v-model:frame="frame"
          v-model:motion="motion"
          :keys
          :disabled="depth !== 'ready'"
          :locale
          @key="emit('key')"
          @remove="emit('removeKey', $event)"
          @clear="emit('clearKeys')"
        />
      </section>
      <section class="flex flex-col gap-2.5 p-5">
        <div class="flex items-center justify-between">
          <label for="reshoot-panel-prompt" :class="labelClass">
            {{ rc('reshoot.section.prompt', locale) }}
          </label>
          <span class="text-[11px] text-primary-warm-gray">
            {{ rc('reshoot.optional', locale) }}
          </span>
        </div>
        <textarea
          id="reshoot-panel-prompt"
          v-model="prompt"
          rows="3"
          :placeholder="rc('reshoot.prompt.placeholder', locale)"
          class="field-sizing-content min-h-20 resize-none rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-4 py-3 text-sm/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:border-primary-comfy-yellow"
        />
      </section>
    </div>
    <footer
      class="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 bg-page/85 p-3 backdrop-blur-sm"
    >
      <ReshootAction
        :depth
        :rendering
        wide
        :locale
        @analyze="emit('analyze')"
        @generate="emit('generate')"
        @cancel="emit('cancel')"
      />
      <p class="text-center text-[11px] text-primary-warm-gray">
        {{ rc('reshoot.demoNote', locale) }}
      </p>
    </footer>
  </aside>
</template>
