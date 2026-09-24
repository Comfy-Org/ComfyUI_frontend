<script setup lang="ts">
import { CircleAlert, CircleStop, LoaderCircle, ShieldAlert } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { aspectStyle } from './aspect-style'

const {
  takes,
  currentId,
  locale = 'en'
} = defineProps<{
  takes: readonly Take[]
  currentId?: string
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

const startsShot = (index: number) =>
  index > 0 && takes[index - 1].shot !== takes[index].shot

function statusClass(take: Take): string | undefined {
  if (take.status !== 'failed') return undefined
  if (take.reason === 'policy' || take.reason === 'validation')
    return 'bg-primary-comfy-orange/10 ring-1 ring-primary-comfy-orange/35 ring-inset'
  if (take.reason === 'noCredits') return undefined
  return 'bg-primary-comfy-red/10 ring-1 ring-primary-comfy-red/35 ring-inset'
}

const blocked = (take: Take) =>
  take.status === 'failed' &&
  (take.reason === 'policy' || take.reason === 'validation')
</script>

<template>
  <nav
    :aria-label="tc('cinematic.stage.sequence', locale)"
    class="flex max-w-full items-center gap-2 overflow-x-auto p-1"
  >
    <button
      v-for="(take, index) in takes"
      :key="take.id"
      type="button"
      :aria-current="take.id === currentId"
      :aria-label="
        tc('cinematic.stage.thumb', locale)
          .replace('{shot}', String(take.shot))
          .replace('{take}', take.letter)
      "
      :class="
        cn(
          'grid h-14 shrink-0 place-items-center overflow-hidden rounded-md bg-transparency-white-t8 transition-opacity',
          startsShot(index) && 'ml-2',
          statusClass(take),
          take.id === currentId
            ? 'opacity-100 outline-2 outline-offset-2 outline-primary-warm-white'
            : 'opacity-50 hover:opacity-100'
        )
      "
      :style="aspectStyle(take.aspect)"
      @click="emit('select', take.id)"
    >
      <img
        v-if="take.status === 'done'"
        :src="take.output.url"
        alt=""
        :class="cn('size-full object-cover', take.output.nsfw && 'blur-md')"
      />
      <LoaderCircle
        v-else-if="take.status === 'rendering'"
        class="size-4 text-primary-comfy-yellow motion-safe:animate-spin"
        aria-hidden="true"
      />
      <CircleStop
        v-else-if="take.status === 'cancelled'"
        class="size-4 text-primary-comfy-canvas"
        aria-hidden="true"
      />
      <ShieldAlert
        v-else-if="blocked(take)"
        class="size-4 text-primary-comfy-orange"
        aria-hidden="true"
      />
      <CircleAlert
        v-else
        class="size-4 text-primary-comfy-red"
        aria-hidden="true"
      />
    </button>
  </nav>
</template>
