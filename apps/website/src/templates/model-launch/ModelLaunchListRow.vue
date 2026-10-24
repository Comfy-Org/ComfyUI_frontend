<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useEventListener,
  useMediaControls,
  useResizeObserver
} from '@vueuse/core'
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchListItem } from './types'

import PlayPauseButton from '@/components/common/PlayPauseButton.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { translationsFor } from '@/i18n/translations'

const {
  locale = 'en',
  item,
  ctaLabel
} = defineProps<{
  item: ModelLaunchListItem
  locale?: Locale
  ctaLabel?: string
}>()
const { t } = translationsFor(locale)

const audioEl = useTemplateRef<HTMLAudioElement>('audioEl')
const { playing } = useMediaControls(audioEl)

useEventListener(audioEl, 'play', () => {
  for (const el of document.querySelectorAll('audio')) {
    if (el !== audioEl.value) el.pause()
  }
})

const promptEl = useTemplateRef<HTMLParagraphElement>('promptEl')
const expanded = shallowRef(false)
const promptOverflows = shallowRef(false)
function measurePromptOverflow() {
  const el = promptEl.value
  promptOverflows.value = el !== null && el.scrollHeight > el.clientHeight
}
onMounted(measurePromptOverflow)
useResizeObserver(promptEl, measurePromptOverflow)

const title = computed(() => item.title[locale] || item.title.en)

const voiceNames = computed(() =>
  item.voices
    .map((voice) => (voice.alias ? `${voice.alias} ${voice.name}` : voice.name))
    .join(', ')
)

const metaLabel = computed(() => {
  const length = t('modelLaunch.clipSeconds', { seconds: item.durationSeconds })
  const voices = t('modelLaunch.voices', {}, { plural: item.voices.length })
  return `${length} · ${voices} ${voiceNames.value}`
})
</script>

<template>
  <li class="flex items-start gap-5 py-8 lg:gap-8">
    <audio ref="audioEl" :aria-label="title" preload="metadata">
      <source
        v-for="source in item.audioSources"
        :key="source.src"
        :src="source.src"
        :type="source.type"
      />
    </audio>

    <PlayPauseButton
      :playing
      :aria-label="playing ? t('player.pause') : t('player.play')"
      @click="playing = !playing"
    />

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-baseline gap-x-2">
        <h3 class="text-lg font-semibold text-primary-warm-white lg:text-xl">
          <a
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-opacity hover:opacity-80"
          >
            {{ title }}
          </a>
        </h3>
        <p class="text-base font-light text-primary-warm-gray">
          {{ metaLabel }}
        </p>
      </div>
      <div class="mt-4 rounded-2xl bg-transparency-white-t8 py-4 pl-5">
        <div class="flex items-end gap-2">
          <p
            ref="promptEl"
            :class="
              cn(
                'flex-1 text-sm/relaxed font-light whitespace-pre-line text-primary-warm-gray',
                !expanded && 'line-clamp-3'
              )
            "
          >
            {{ item.prompt }}
          </p>
          <CopyTextButton
            class="-mb-2"
            :value="item.prompt"
            :label="t('modelLaunch.copyPrompt')"
            :copied-label="t('ui.copied')"
          />
        </div>
        <button
          v-if="expanded || promptOverflows"
          type="button"
          class="mt-2 cursor-pointer text-sm/relaxed font-light text-primary-comfy-canvas underline underline-offset-4 transition-colors hover:text-primary-comfy-yellow"
          @click="expanded = !expanded"
        >
          {{ expanded ? t('ui.readLess') : t('ui.readMore') }}
        </button>
      </div>
      <p class="mt-4 text-sm md:hidden">
        <a
          v-if="ctaLabel"
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
          class="font-bold tracking-wider text-primary-comfy-yellow underline underline-offset-4 transition-opacity hover:opacity-80"
        >
          {{ ctaLabel }}
        </a>
      </p>
    </div>

    <a
      v-if="ctaLabel"
      :href="item.href"
      target="_blank"
      rel="noopener noreferrer"
      class="hidden shrink-0 pt-1 text-sm font-bold tracking-wider text-primary-comfy-yellow underline underline-offset-4 transition-opacity hover:opacity-80 md:block"
    >
      {{ ctaLabel }}
    </a>
  </li>
</template>
