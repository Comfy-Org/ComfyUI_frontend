<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'

import type { LearningTutorial } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import { lockScroll, unlockScroll } from '../../composables/scrollLock'
import { t } from '../../i18n/translations'
import VideoPlayer from '../common/VideoPlayer.vue'

const { tutorial, locale = 'en' } = defineProps<{
  tutorial: LearningTutorial
  locale?: Locale
}>()

const emit = defineEmits<{ close: [] }>()

const dialogRef = useTemplateRef<HTMLDialogElement>('dialogRef')

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  lockScroll()
  dialogRef.value?.showModal()
})

onUnmounted(() => {
  unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      :aria-label="tutorial.title[locale]"
      class="fixed inset-0 z-50 flex size-full max-h-none max-w-none flex-col items-center justify-center border-0 bg-transparent px-4 py-8 backdrop-blur-xl backdrop:bg-transparent lg:px-20 lg:py-8"
      @click="handleBackdropClick"
      @keydown="handleKeydown"
      @close="emit('close')"
    >
      <button
        :aria-label="t('gallery.detail.close', locale)"
        class="border-primary-comfy-yellow hover:bg-primary-comfy-yellow group absolute top-8 right-10 z-10 flex size-10 cursor-pointer items-center justify-center rounded-2xl border-2 bg-primary-comfy-ink transition-colors lg:right-26"
        @click="emit('close')"
      >
        <span
          class="bg-primary-comfy-yellow size-5 transition-colors group-hover:bg-primary-comfy-ink"
          style="mask: url('/icons/close.svg') center / contain no-repeat"
        />
      </button>

      <div
        class="border-primary-comfy-yellow rounded-5xl flex w-full max-w-7xl items-center justify-center overflow-hidden border-2 bg-primary-comfy-ink p-3 lg:p-4"
      >
        <VideoPlayer
          :key="tutorial.id"
          :locale
          :src="tutorial.videoSrc"
          :poster="tutorial.poster"
          autoplay
          class="w-full"
        />
      </div>

      <h2
        class="mt-6 text-center text-lg font-medium text-primary-comfy-canvas lg:text-xl"
      >
        {{ t('learning.tutorials.titlePrefix', locale) }}
        {{ tutorial.title[locale] }}
      </h2>
    </dialog>
  </Teleport>
</template>
