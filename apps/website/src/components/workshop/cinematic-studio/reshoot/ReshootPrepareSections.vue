<script setup lang="ts">
import type {
  ReshootAspect,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootClipControls from './ReshootClipControls.vue'

const {
  clip,
  clipName,
  isExample,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  isExample: boolean
  locale?: Locale
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })
const prompt = defineModel<string>('prompt', { required: true })

const labelClass =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
</script>

<template>
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
</template>
