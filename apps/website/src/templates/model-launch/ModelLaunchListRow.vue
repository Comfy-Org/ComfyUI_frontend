<script setup lang="ts">
import { useEventListener, useMediaControls } from '@vueuse/core'
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchListItem } from './types'

import PlayPauseButton from '@/components/common/PlayPauseButton.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { translationsFor } from '@/i18n/translations'
import { formatClock } from '@/utils/formatClock'

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

const clipSeconds = shallowRef(0)
function readClipSeconds() {
  const seconds = audioEl.value?.duration ?? 0
  clipSeconds.value = Number.isFinite(seconds) ? seconds : 0
}
onMounted(readClipSeconds)
useEventListener(audioEl, 'durationchange', readClipSeconds)

useEventListener(audioEl, 'play', () => {
  for (const el of document.querySelectorAll('audio')) {
    if (el !== audioEl.value) el.pause()
  }
})

const title = computed(() => item.title[locale] || item.title.en)

const durationLabel = computed(() =>
  clipSeconds.value ? formatClock(clipSeconds.value) : ''
)

const voicesLabel = computed(() =>
  t('modelLaunch.voices', {}, { plural: item.voices.length })
)

const voiceNames = computed(() =>
  item.voices
    .map((voice) => (voice.alias ? `${voice.alias} ${voice.name}` : voice.name))
    .join(' · ')
)
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
      variant="muted"
      :aria-label="playing ? t('player.pause') : t('player.play')"
      @click="playing = !playing"
    />

    <div class="min-w-0 flex-1">
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
      <p
        class="mt-2 max-w-3xl text-base/relaxed font-light text-primary-warm-gray"
      >
        {{ item.description[locale] || item.description.en }}
      </p>
      <p
        class="mt-3 flex flex-wrap items-center gap-x-6 text-sm text-primary-warm-gray tabular-nums md:hidden"
      >
        <span v-if="durationLabel">{{ durationLabel }}</span>
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
      <p class="mt-4 text-sm text-primary-warm-gray">
        <span class="font-semibold text-primary-warm-white">
          {{ voicesLabel }}
        </span>
        {{ voiceNames }}
      </p>
      <div
        class="mt-3 flex max-w-3xl items-end gap-2 rounded-2xl bg-transparency-white-t8 py-4 pl-5"
      >
        <p
          class="flex-1 text-sm/relaxed font-light whitespace-pre-line text-primary-warm-gray"
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
    </div>

    <div
      class="hidden shrink-0 items-center gap-12 pt-1 text-base text-primary-warm-gray tabular-nums md:flex lg:gap-16"
    >
      <span v-if="durationLabel" class="min-w-12 text-right">
        {{ durationLabel }}
      </span>
      <a
        v-if="ctaLabel"
        :href="item.href"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm font-bold tracking-wider text-primary-comfy-yellow underline underline-offset-4 transition-opacity hover:opacity-80"
      >
        {{ ctaLabel }}
      </a>
    </div>
  </li>
</template>
