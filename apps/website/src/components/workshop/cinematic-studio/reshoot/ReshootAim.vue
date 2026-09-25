<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { DepthState } from '../../../../composables/useReshootDemo'
import type {
  CameraKey,
  ReshootCamera,
  ReshootMotion
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootAimRig from './ReshootAimRig.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'
import ReshootViewport from './ReshootViewport.vue'

const {
  clip,
  camera,
  keys,
  depth,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  depth: DepthState
  locale?: Locale
}>()

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  key: []
  removeKey: [frame: number]
  clearKeys: []
  reset: []
  apply: []
}>()

const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })
const motion = defineModel<ReshootMotion>('motion', { required: true })
</script>

<template>
  <section
    :aria-label="rc('reshoot.aim.title', locale)"
    class="mx-auto flex w-full max-w-6xl flex-col gap-4"
    data-testid="reshoot-aim"
  >
    <header
      class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
    >
      <h1 class="text-xl font-semibold text-primary-warm-white">
        {{ rc('reshoot.aim.title', locale) }}
      </h1>
      <p class="text-xs text-primary-warm-gray">
        {{ rc('reshoot.aim.hint', locale) }}
      </p>
    </header>
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="flex min-w-0 flex-col gap-4">
        <div
          class="relative aspect-video w-full rounded-md ring-1 ring-transparency-white-t8"
        >
          <ReshootViewport
            :clip
            :camera
            :depth
            aimable
            :locale
            @aim="emit('aim', $event)"
          />
          <figure
            class="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 rounded-xl bg-primary-comfy-ink/85 p-1 max-sm:hidden"
          >
            <video
              :src="clip"
              autoplay
              muted
              loop
              playsinline
              class="aspect-video w-36 rounded-lg object-cover"
            />
            <figcaption
              class="px-1 pb-0.5 text-[11px] text-primary-comfy-canvas"
            >
              {{ rc('reshoot.aim.original', locale) }}
            </figcaption>
          </figure>
        </div>
        <div
          class="rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-4"
        >
          <h2
            class="mb-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ rc('reshoot.section.move', locale) }}
          </h2>
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
        </div>
      </div>
      <aside
        class="flex h-fit flex-col gap-3 rounded-2xl bg-primary-comfy-ink-light p-4 lg:sticky lg:top-24"
      >
        <ReshootAimRig
          v-model:keep-aim="keepAim"
          :clip
          :camera
          :disabled="depth !== 'ready'"
          :locale
          @aim="emit('aim', $event)"
        />
        <div class="mt-1 grid grid-cols-2 gap-2">
          <Button variant="outline" class="rounded-full" @click="emit('reset')">
            {{ rc('reshoot.aim.reset', locale) }}
          </Button>
          <Button
            class="rounded-full"
            :disabled="depth !== 'ready'"
            data-testid="reshoot-apply"
            @click="emit('apply')"
          >
            {{ rc('reshoot.aim.apply', locale) }}
          </Button>
        </div>
      </aside>
    </div>
  </section>
</template>
