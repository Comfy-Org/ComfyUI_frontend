<script setup lang="ts">
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
</script>

<template>
  <nav
    :aria-label="tc('cinematic.stage.sequence', locale)"
    class="flex h-20 shrink-0 items-center gap-3 overflow-x-auto border-t border-transparency-white-t8 px-4 sm:h-24 sm:px-5"
  >
    <span
      class="mr-2 shrink-0 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ tc('cinematic.stage.sequence', locale) }}
    </span>
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
          'h-14 shrink-0 overflow-hidden rounded-sm bg-transparency-white-t8 transition-opacity',
          startsShot(index) && 'ml-3',
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
        class="size-full object-cover"
      />
    </button>
  </nav>
</template>
