<script setup lang="ts">
import { KeyRound, LoaderCircle, Orbit } from '@lucide/vue'
import { computed } from 'vue'

import type { DepthState } from '../../../../composables/useReshootDemo'
import type { ReshootCamera } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { cameraZone } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import ReshootZone from './ReshootZone.vue'

const {
  camera,
  keyCount,
  depth,
  locale = 'en'
} = defineProps<{
  camera: Readonly<ReshootCamera>
  keyCount: number
  depth: DepthState
  locale?: Locale
}>()

const emit = defineEmits<{ aim: [] }>()

const moveLabel = computed(() =>
  keyCount > 1
    ? rc('reshoot.move.keys', locale).replace('{count}', String(keyCount))
    : rc('reshoot.move.static', locale)
)

const chipClass =
  'flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] whitespace-nowrap text-primary-comfy-canvas ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white'
</script>

<template>
  <span
    v-if="depth === 'analyzing'"
    :class="chipClass"
    role="status"
    data-testid="reshoot-reading"
  >
    <LoaderCircle
      class="size-3.5 text-primary-comfy-yellow motion-safe:animate-spin"
      aria-hidden="true"
    />
    {{ rc('reshoot.aim.reading', locale) }}
  </span>
  <template v-else>
    <button type="button" :class="chipClass" @click="emit('aim')">
      <Orbit class="size-3.5" aria-hidden="true" />
      <ReshootZone :zone="cameraZone(camera)" dot-only />
      {{ rc('reshoot.section.camera', locale) }}
      <span class="font-mono text-primary-warm-gray tabular-nums">
        {{ camera.azimuth }}° · {{ camera.elevation }}°
      </span>
    </button>
    <button type="button" :class="chipClass" @click="emit('aim')">
      <KeyRound class="size-3.5" aria-hidden="true" />
      {{ moveLabel }}
    </button>
  </template>
</template>
