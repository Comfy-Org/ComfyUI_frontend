<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchAudioGallery } from './types'

import { translationsFor } from '@/i18n/translations'

import ModelLaunchAudioPromptWindow from './ModelLaunchAudioPromptWindow.vue'
import ModelLaunchAudioTrackList from './ModelLaunchAudioTrackList.vue'

const { locale = 'en', audioGallery } = defineProps<{
  audioGallery: ModelLaunchAudioGallery
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selectedId = shallowRef(audioGallery.cards[0]?.id)
// Stays false until a visitor picks a track, so the page never makes sound on
// its own.
const picked = shallowRef(false)

const selected = computed(
  () =>
    audioGallery.cards.find((card) => card.id === selectedId.value) ??
    audioGallery.cards[0]
)

function select(id: string) {
  selectedId.value = id
  picked.value = true
}
</script>

<template>
  <section
    v-if="selected"
    class="mx-auto max-w-9xl px-4 py-16 lg:px-20 lg:py-24"
  >
    <div class="mx-auto flex max-w-3xl flex-col items-center text-center">
      <h2
        v-if="audioGallery.headingKey"
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(audioGallery.headingKey) }}
      </h2>
      <p
        v-if="audioGallery.subtitleKey"
        class="mt-4 text-[17px]/relaxed font-light text-primary-comfy-canvas"
      >
        {{ t(audioGallery.subtitleKey) }}
      </p>
    </div>

    <div
      class="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-4 rounded-5xl bg-transparency-white-t4 p-2 lg:grid-cols-5 lg:gap-2"
    >
      <ModelLaunchAudioTrackList
        :cards="audioGallery.cards"
        :selected-id="selected.id"
        :locale
        @select="select"
      />

      <ModelLaunchAudioPromptWindow
        :card="selected"
        :model="audioGallery.model"
        :autoplay="picked"
        :locale
      />
    </div>
  </section>
</template>
