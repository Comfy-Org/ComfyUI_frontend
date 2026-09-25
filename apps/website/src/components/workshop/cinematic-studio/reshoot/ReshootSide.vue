<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
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
import ReshootAimRig from './ReshootAimRig.vue'
import ReshootClipControls from './ReshootClipControls.vue'
import ReshootDisclosure from './ReshootDisclosure.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'

const {
  clip,
  clipName,
  isExample,
  camera,
  keys,
  depth,
  canReuse,
  locale = 'en'
} = defineProps<{
  clip: string
  clipName: string
  isExample: boolean
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  depth: DepthState
  canReuse: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  key: []
  removeKey: [frame: number]
  clearKeys: []
  reuse: []
  generate: []
}>()

const upload = defineModel<File | undefined>('upload')
const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })
const seed = defineModel<number>('seed', { required: true })
const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const motion = defineModel<ReshootMotion>('motion', { required: true })
const prompt = defineModel<string>('prompt', { required: true })

const formatOpen = ref(false)
const ready = computed(() => depth === 'ready')
const moveValue = computed(() =>
  keys.length > 1
    ? rc('reshoot.move.keys', locale).replace('{count}', String(keys.length))
    : rc('reshoot.move.static', locale)
)
const formatValue = computed(() =>
  [
    aspect.value === 'source'
      ? rc('reshoot.aspect.source', locale)
      : aspect.value,
    size.value,
    `${rc('reshoot.seed', locale).toLowerCase()} ${seed.value}`
  ].join(' · ')
)
</script>

<template>
  <aside
    :aria-label="rc('reshoot.panel', locale)"
    class="flex min-w-0 flex-col rounded-2xl bg-primary-comfy-ink-light lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)]"
  >
    <header
      class="flex items-center gap-3 border-b border-transparency-white-t8 px-4 py-3.5"
    >
      <video
        :src="clip"
        muted
        playsinline
        preload="metadata"
        class="aspect-video w-14 shrink-0 rounded-md bg-primary-comfy-ink object-cover"
      />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-sm font-semibold text-primary-warm-white">
          {{ rc('reshoot.title', locale) }}
        </span>
        <span class="truncate text-[11px] text-primary-warm-gray">
          {{ isExample ? rc('reshoot.clip.example', locale) : clipName }} ·
          {{ rc(ready ? 'reshoot.clip.ready' : 'reshoot.aim.reading', locale) }}
        </span>
      </span>
      <button
        type="button"
        class="h-7 shrink-0 rounded-full bg-transparency-white-t8 px-3 text-[11px] text-primary-comfy-canvas hover:text-primary-warm-white"
        @click="formatOpen = true"
      >
        {{ rc('reshoot.clip.change', locale) }}
      </button>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      <ReshootAimRig
        v-model:keep-aim="keepAim"
        :clip
        :camera
        :disabled="!ready"
        :locale
        @aim="emit('aim', $event)"
      />
      <ReshootDisclosure
        :label="rc('reshoot.section.move', locale)"
        :value="moveValue"
        :disabled="!ready"
      >
        <ReshootMoveControls
          v-model:frame="frame"
          v-model:motion="motion"
          :keys
          :locale
          @key="emit('key')"
          @remove="emit('removeKey', $event)"
          @clear="emit('clearKeys')"
        />
      </ReshootDisclosure>
      <div class="flex flex-col gap-1.5">
        <label for="reshoot-prompt" class="sr-only">
          {{ rc('reshoot.section.prompt', locale) }}
        </label>
        <textarea
          id="reshoot-prompt"
          v-model="prompt"
          rows="2"
          :placeholder="rc('reshoot.prompt.placeholder', locale)"
          aria-describedby="reshoot-prompt-dialogue"
          class="field-sizing-content max-h-40 min-h-16 resize-none rounded-xl bg-transparency-white-t4 px-3.5 py-2.5 text-sm/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
        />
        <p
          id="reshoot-prompt-dialogue"
          class="text-[11px]/relaxed text-primary-warm-gray"
        >
          {{ rc('reshoot.prompt.dialogue', locale) }}
        </p>
      </div>
      <ReshootDisclosure
        v-model:open="formatOpen"
        :label="rc('reshoot.section.format', locale)"
        :value="formatValue"
      >
        <ReshootClipControls
          v-model:upload="upload"
          v-model:aspect="aspect"
          v-model:size="size"
          v-model:seed="seed"
          :clip
          :clip-name="clipName"
          :is-example="isExample"
          :locale
        />
      </ReshootDisclosure>
    </div>

    <footer
      class="flex flex-col gap-2 rounded-b-2xl border-t border-transparency-white-t8 p-4"
    >
      <Button
        v-if="canReuse"
        variant="outline"
        class="rounded-full"
        @click="emit('reuse')"
      >
        {{ rc('reshoot.reuse', locale) }}
      </Button>
      <Button
        size="lg"
        class="rounded-full"
        :disabled="!ready"
        data-testid="reshoot-action"
        @click="emit('generate')"
      >
        {{ rc('reshoot.generate', locale) }}
      </Button>
      <p class="text-center text-[11px] text-primary-warm-gray">
        {{
          rc(ready ? 'reshoot.generate.note' : 'reshoot.generate.wait', locale)
        }}
      </p>
    </footer>
  </aside>
</template>
