<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { Download, RotateCcw, Volume2 } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { ReshootTake } from '@/composables/useReshoot'
import type { Locale } from '@/i18n/translations'
import type { ReshootSound, ReshootView } from './output'

const {
  take,
  href,
  fileName,
  locale = 'en'
} = defineProps<{
  take: ReshootTake
  href: string
  fileName: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ reuse: [] }>()

const view = defineModel<ReshootView>('view', { required: true })
const sound = defineModel<ReshootSound>('sound', { required: true })

const views = computed<readonly ReshootView[]>(() =>
  take.warpUrl ? ['result', 'warp', 'source'] : ['result', 'source']
)

const iconClass =
  'grid size-8 shrink-0 place-items-center rounded-lg text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none'
</script>

<template>
  <div class="flex max-w-full min-w-0 items-center gap-1.5">
    <div
      class="flex gap-0.5 rounded-full border border-transparency-white-t8 p-0.5"
      role="radiogroup"
      :aria-label="t('reshoot.views')"
    >
      <button
        v-for="option in views"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="view === option"
        :class="
          cn(
            'min-h-7 rounded-full px-3 text-xs font-semibold whitespace-nowrap text-primary-warm-white transition-colors hover:bg-transparency-white-t8',
            view === option && 'bg-transparency-white-t20'
          )
        "
        @click="view = option"
      >
        {{ t(`reshoot.view.${option}`) }}
      </button>
    </div>
    <button
      v-if="view === 'result' && take.originalUrl"
      type="button"
      :aria-pressed="sound === 'original'"
      :aria-label="t('reshoot.sound.original')"
      :title="
        t(
          sound === 'original'
            ? 'reshoot.sound.original'
            : 'reshoot.sound.generated'
        )
      "
      :class="
        cn(iconClass, sound === 'original' && 'bg-transparency-white-t20')
      "
      @click="sound = sound === 'original' ? 'generated' : 'original'"
    >
      <Volume2 class="size-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      :aria-label="t('reshoot.reuse')"
      :title="t('reshoot.reuse')"
      :class="iconClass"
      @click="emit('reuse')"
    >
      <RotateCcw class="size-4" aria-hidden="true" />
    </button>
    <a
      :href
      :download="fileName"
      :aria-label="t('reshoot.download')"
      :title="t('reshoot.download')"
      :class="iconClass"
    >
      <Download class="size-4" aria-hidden="true" />
    </a>
  </div>
</template>
