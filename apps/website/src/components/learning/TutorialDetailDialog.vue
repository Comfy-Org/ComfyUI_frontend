<script setup lang="ts">
// Trello-style tutorial card: the tutorial page renders the directory behind
// this dialog, which is SSR'd open (the `open` attribute, no teleport) so the
// tutorial's heading stays in the static HTML. On mount it is upgraded to a
// modal (focus trap, top layer). Closing removes the tutorial from the URL:
// back to the directory the visitor came from, or over to the category page
// on a direct visit.
import { onMounted, onUnmounted, useTemplateRef } from 'vue'

import { lockScroll, unlockScroll } from '../../composables/scrollLock'
import { localizeHref } from '../../config/routes'
import type { LearningTutorial } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import { categoryPath, tutorialDescription } from '../../data/learningTutorials'
import { t } from '../../i18n/translations'
import VideoPlayer from '../common/VideoPlayer.vue'

const { tutorial, locale = 'en' } = defineProps<{
  tutorial: LearningTutorial
  locale?: Locale
}>()

const dialogEl = useTemplateRef<HTMLDialogElement>('dialogEl')

const description = tutorialDescription(tutorial, locale)

// Prefer the Navigation API's previous same-origin entry; referrer is a
// fallback for browsers without it and is often stripped.
const previousEntryUrl = () => {
  const nav = window.navigation
  if (nav) return nav.entries()[nav.currentEntry.index - 1]?.url ?? null
  return document.referrer || null
}

const cameFromDirectory = () => {
  const previous = previousEntryUrl()
  if (!previous) return false
  try {
    const url = new URL(previous)
    return (
      url.origin === location.origin &&
      url.pathname.startsWith(localizeHref('/learning', locale))
    )
  } catch {
    return false
  }
}

const closeDialog = () => {
  // Navigation replaces the document; skip restoring the locked scroll.
  unlockScroll({ skipRestore: true })
  if (cameFromDirectory() && history.length > 1) {
    history.back()
  } else {
    location.assign(localizeHref(categoryPath(tutorial.category), locale))
  }
}

const onBackdropClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) closeDialog()
}

onMounted(() => {
  lockScroll()
  const el = dialogEl.value
  if (!el) return
  // SSR renders the dialog `open` (non-modal); reopen as a modal for the
  // native focus trap and top layer.
  el.close()
  el.showModal()
})

onUnmounted(() => {
  unlockScroll({ skipRestore: true })
})
</script>

<template>
  <dialog
    ref="dialogEl"
    open
    :aria-label="tutorial.title[locale]"
    class="fixed inset-0 z-50 flex size-full max-h-none max-w-none flex-col items-center justify-center border-0 bg-transparent px-4 py-8 backdrop-blur-xl backdrop:bg-transparent lg:px-20 lg:py-8"
    @click="onBackdropClick"
    @cancel.prevent="closeDialog"
  >
    <button
      :aria-label="t('learning.detail.close', locale)"
      class="border-primary-comfy-yellow hover:bg-primary-comfy-yellow group absolute top-8 right-10 z-10 flex size-10 cursor-pointer items-center justify-center rounded-2xl border-2 bg-primary-comfy-ink transition-colors lg:right-26"
      @click="closeDialog"
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
        :tracks="tutorial.caption"
        autoplay
        autoplay-unmuted
        class="w-full"
      />
    </div>

    <h1
      class="mt-6 text-center text-lg font-medium text-primary-comfy-canvas lg:text-xl"
    >
      {{ t('learning.tutorials.titlePrefix', locale) }}
      {{ tutorial.title[locale] }}
    </h1>
    <p class="sr-only">{{ description }}</p>
  </dialog>
</template>
