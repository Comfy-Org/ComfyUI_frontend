<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { framedStyle } from './aspect-style'
import CinematicTakeMedia from './CinematicTakeMedia.vue'
import CinematicTakeNotice from './CinematicTakeNotice.vue'
import CinematicTakeProgress from './CinematicTakeProgress.vue'

const {
  current,
  otherModel,
  memberWorkspace,
  height = '58svh',
  locale = 'en'
} = defineProps<{
  current: Take
  otherModel?: { slug: string; name: string }
  memberWorkspace?: string
  height?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  retry: []
  switchModel: [slug: string]
  editScene: []
}>()

const revealed = ref(false)
// A finished take keeps its frame until the picture has loaded: without it
// the frame has no size for a moment and the whole stage jumps.
const loaded = defineModel<boolean>('loaded', { default: false })
watch(
  () => current.id,
  () => {
    revealed.value = false
    loaded.value = false
  }
)
const settled = computed(() => current.status === 'done' && loaded.value)
// A withheld NSFW clip has no <video> mounted yet, so `loaded` cannot fire and
// the spinner would sit under the privacy overlay until the reveal. `loaded`
// stays false on purpose, so the frame keeps its size until real media arrives.
const withheld = computed(
  () =>
    current.status === 'done' &&
    current.output.kind === 'video' &&
    !!current.output.nsfw &&
    !revealed.value
)

const TONE = {
  neutral:
    'bg-transparency-white-t4 ring-1 ring-transparency-white-t8 ring-inset',
  warning:
    'bg-primary-comfy-orange/5 ring-1 ring-primary-comfy-orange/25 ring-inset',
  credits:
    'bg-primary-comfy-yellow/5 ring-1 ring-primary-comfy-yellow/25 ring-inset',
  error: 'bg-primary-comfy-red/5 ring-1 ring-primary-comfy-red/25 ring-inset'
} as const

function frameTone(take: Take): string | undefined {
  if (take.status === 'rendering') return 'bg-black/20'
  if (take.status === 'cancelled') return TONE.neutral
  if (take.status !== 'failed') return undefined
  if (take.reason === 'policy' || take.reason === 'validation')
    return TONE.warning
  return take.reason === 'noCredits' ? TONE.credits : TONE.error
}
</script>

<template>
  <figure
    :class="
      cn(
        'group relative flex max-w-full items-center justify-center overflow-hidden rounded-md',
        current.status === 'done' && !loaded ? TONE.neutral : frameTone(current)
      )
    "
    :style="settled ? undefined : framedStyle(current.aspect, height)"
  >
    <template v-if="current.status === 'done'">
      <CinematicTakeMedia
        v-model:revealed="revealed"
        :current
        :height
        :pending="!loaded"
        :locale
        @loaded="loaded = true"
      />
      <LoaderCircle
        v-if="!loaded && !withheld"
        class="size-5 animate-spin text-primary-warm-gray"
        :aria-label="tc('cinematic.stage.loadingTake', locale)"
      />
    </template>
    <CinematicTakeProgress
      v-else-if="current.status === 'rendering'"
      :take="current"
      :locale
    />
    <CinematicTakeNotice
      v-else
      :take="current"
      :other-model="otherModel"
      :member-workspace="memberWorkspace"
      :locale
      @retry="emit('retry')"
      @switch-model="emit('switchModel', $event)"
      @edit-scene="emit('editScene')"
    />
    <slot />
  </figure>
</template>
