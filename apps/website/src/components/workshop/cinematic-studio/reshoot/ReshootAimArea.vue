<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DepthState } from '@/composables/useReshoot'
import type {
  CameraKey,
  ReshootCamera
} from '@/lib/workshop/cinematic-studio/reshoot'
import type { Locale } from '@/i18n/translations'
import ReshootAimPending from './ReshootAimPending.vue'
import ReshootAimRig from './ReshootAimRig.vue'
import ReshootDisclosure from './ReshootDisclosure.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'

const {
  clip,
  camera,
  keys,
  depth,
  reason,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  keys: readonly CameraKey[]
  depth: DepthState
  /** Why the depth is not ready, when it failed or never started. */
  reason?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  removeKey: [frame: number]
  analyze: []
}>()

const keepAim = defineModel<boolean>('keepAim', { required: true })
const frame = defineModel<number>('frame', { required: true })

const pending = computed(() => (depth === 'ready' ? undefined : depth))
</script>

<template>
  <div class="grid">
    <div
      :class="
        cn(
          'col-start-1 row-start-1 flex flex-col gap-2 transition-[opacity,visibility] motion-safe:duration-300',
          pending && 'invisible opacity-0'
        )
      "
      :inert="!!pending"
      data-testid="reshoot-aim-controls"
    >
      <ReshootAimRig
        v-model:keep-aim="keepAim"
        :clip
        :camera
        :locale
        @aim="emit('aim', $event)"
      />
      <ReshootDisclosure :label="t('reshoot.section.move')">
        <ReshootMoveControls
          v-model:frame="frame"
          :keys
          :locale
          @remove="emit('removeKey', $event)"
        />
      </ReshootDisclosure>
    </div>
    <ReshootAimPending
      v-if="pending"
      :depth="pending"
      :reason
      :locale
      class="col-start-1 row-start-1 self-start"
      @retry="emit('analyze')"
    />
  </div>
</template>
