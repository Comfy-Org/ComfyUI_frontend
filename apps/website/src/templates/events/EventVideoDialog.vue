<script setup lang="ts">
// Trello-style event card: an /events/[slug] page renders the events
// directory behind this dialog, which is SSR'd open (the `open` attribute, no
// teleport) so the event's heading stays in the static HTML. On mount it is
// upgraded to a modal (focus trap, top layer). Closing removes the event from
// the URL: back to /events when the visitor came from there, or over to
// /events on a direct visit.
import { computed, onMounted, onUnmounted, useTemplateRef } from 'vue'

import AddToCalendarButton from '../../components/blocks/AddToCalendarButton.vue'
import { lockScroll, unlockScroll } from '../../composables/scrollLock'
import { localizeHref } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import type { CalendarEvent } from '../../utils/calendar'

import { t } from '../../i18n/translations'
import { isUrlUnderPath, previousEntryUrl } from '../../utils/previousEntry'

const { title, description, youtubeVideoId, calendarEvent, locale } =
  defineProps<{
    title: string
    description: string
    youtubeVideoId: string
    /** Future events: offer adding the stream to the visitor's calendar. */
    calendarEvent?: CalendarEvent
    locale: Locale
  }>()

const dialogEl = useTemplateRef<HTMLDialogElement>('dialogEl')

const embedUrl = computed(
  () =>
    `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&rel=0`
)

const cameFromDirectory = () =>
  isUrlUnderPath(
    previousEntryUrl(window.navigation, document.referrer),
    location.origin,
    localizeHref('/events', locale)
  )

const closeDialog = () => {
  // Navigation replaces the document; skip restoring the locked scroll.
  unlockScroll({ skipRestore: true })
  if (cameFromDirectory() && history.length > 1) {
    history.back()
  } else {
    location.assign(localizeHref('/events', locale))
  }
}

const onBackdropClick = (mouseEvent: MouseEvent) => {
  if (mouseEvent.target === mouseEvent.currentTarget) closeDialog()
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
    :aria-label="title"
    class="fixed inset-0 z-50 flex size-full max-h-none max-w-none flex-col items-center justify-center border-0 bg-transparent px-4 py-8 backdrop-blur-xl backdrop:bg-transparent lg:px-20 lg:py-8"
    @click="onBackdropClick"
    @cancel.prevent="closeDialog"
  >
    <button
      :aria-label="t('events.videoDialog.close', locale)"
      class="border-primary-comfy-yellow hover:bg-primary-comfy-yellow group absolute top-8 right-10 z-10 flex size-10 cursor-pointer items-center justify-center rounded-2xl border-2 bg-primary-comfy-ink transition-colors lg:right-26"
      @click="closeDialog"
    >
      <span
        class="bg-primary-comfy-yellow size-5 transition-colors group-hover:bg-primary-comfy-ink"
        style="mask: url('/icons/close.svg') center / contain no-repeat"
      />
    </button>

    <div
      class="border-primary-comfy-yellow rounded-5xl w-full max-w-7xl overflow-hidden border-2 bg-primary-comfy-ink p-3 lg:p-4"
    >
      <div class="aspect-video w-full overflow-hidden rounded-3xl">
        <iframe
          :src="embedUrl"
          :title
          class="size-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        />
      </div>
    </div>

    <h1
      class="mt-6 text-center text-lg font-medium text-primary-comfy-canvas lg:text-xl"
    >
      {{ title }}
    </h1>
    <div v-if="calendarEvent" class="mt-4">
      <AddToCalendarButton
        size="default"
        portal-disabled
        :event="calendarEvent"
        :locale
      />
    </div>
    <p class="sr-only">{{ description }}</p>
  </dialog>
</template>
