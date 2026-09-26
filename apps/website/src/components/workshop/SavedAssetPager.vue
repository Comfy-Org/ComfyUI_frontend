<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { t } from '../../i18n/translations'
import type { Locale } from '../../i18n/translations'

const {
  index,
  total,
  locale = 'en'
} = defineProps<{
  index: number
  total: number
  locale?: Locale
}>()

const emit = defineEmits<{ step: [delta: number] }>()

const navClass =
  'absolute top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-primary-comfy-ink/80 text-primary-warm-white transition-colors hover:text-primary-comfy-yellow disabled:cursor-default disabled:opacity-30'

const dotClass = (active: boolean) =>
  cn(
    'size-2 cursor-pointer rounded-full transition-colors',
    active
      ? 'bg-primary-comfy-yellow'
      : 'bg-transparency-white-t20 hover:bg-transparency-white-t40'
  )
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      v-for="dot in total"
      :key="dot"
      type="button"
      :aria-label="t('workshop.assets.go', locale).replace('{n}', String(dot))"
      :aria-current="dot - 1 === index"
      :class="dotClass(dot - 1 === index)"
      @click="emit('step', dot - 1 - index)"
    />
  </div>

  <button
    type="button"
    :aria-label="t('workshop.assets.previous', locale)"
    :disabled="index === 0"
    :class="cn(navClass, 'left-4')"
    data-testid="saved-asset-previous"
    @click="emit('step', -1)"
  >
    <ChevronLeft class="size-5" aria-hidden="true" />
  </button>
  <button
    type="button"
    :aria-label="t('workshop.assets.next', locale)"
    :disabled="index >= total - 1"
    :class="cn(navClass, 'right-4')"
    data-testid="saved-asset-next"
    @click="emit('step', 1)"
  >
    <ChevronRight class="size-5" aria-hidden="true" />
  </button>
</template>
