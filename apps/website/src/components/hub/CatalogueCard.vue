<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import { usePreviewVideo } from '../../composables/usePreviewVideo'
import type { Locale } from '../../i18n/translations'
import type { CardView } from '../../lib/hub/catalogue-card'
import HubCardCompare from './HubCardCompare.vue'
import HubCardMark from './HubCardMark.vue'
import HubCardReach from './HubCardReach.vue'
import TagRow from './TagRow.vue'

const { view, locale = 'en' } = defineProps<{
  view: CardView
  locale?: Locale
}>()

const video = useTemplateRef<HTMLVideoElement>('video')
const previewSrc = usePreviewVideo(video, () =>
  view.media?.kind === 'video' ? view.media.url : undefined
)

// Halfway is what a card shows at rest, on a phone, and before the pointer
// ever reaches it.
const frame = useTemplateRef<HTMLElement>('frame')
const split = ref(50)

// The link covers the whole card, so the move is read where it lands and
// measured against the artwork underneath it.
function followPointer(event: MouseEvent) {
  if (!view.compare) return
  const frameRect = frame.value?.getBoundingClientRect()
  if (!frameRect?.width) return
  const reached = ((event.clientX - frameRect.left) / frameRect.width) * 100
  split.value = Math.min(100, Math.max(0, reached))
}
</script>

<template>
  <div
    class="group relative flex h-full min-w-0 flex-col gap-3 rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 hover:bg-hub-surface-hover"
    data-testid="catalogue-card"
    :data-kind="view.kind"
    @mousemove="followPointer"
  >
    <a
      :href="view.href"
      class="absolute inset-0 z-10 rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="catalogue-card-link"
    >
      <span class="sr-only">{{ view.title }}</span>
    </a>
    <!-- The link names the card and the heading says it again, so the
      artwork stays decorative rather than naming it a third time. -->
    <div
      ref="frame"
      class="relative aspect-4/3 overflow-hidden rounded-3.5xl bg-hub-surface-hover"
      data-testid="catalogue-card-frame"
    >
      <HubCardMark
        v-if="view.mark.label"
        :label="view.mark.label"
        :logo="view.mark.logo"
      />

      <HubCardReach :reach="view.reach" :locale />

      <video
        v-if="view.media?.kind === 'video'"
        ref="video"
        :src="previewSrc"
        aria-hidden="true"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        muted
        loop
        playsinline
        preload="metadata"
      />
      <template v-else-if="view.media?.kind === 'image'">
        <HubCardCompare
          v-if="view.compare && view.hoverMedia"
          :still="view.media.url"
          :over="view.hoverMedia"
          :split
        />
        <template v-else>
          <img
            :src="view.media.url"
            alt=""
            loading="lazy"
            decoding="async"
            draggable="false"
            class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
            data-testid="catalogue-card-still"
          />
          <img
            v-if="view.hoverMedia"
            :src="view.hoverMedia"
            alt=""
            loading="lazy"
            decoding="async"
            draggable="false"
            class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 select-none group-hover:opacity-100"
          />
        </template>
      </template>
      <div
        v-else
        class="grid size-full place-items-center"
        data-testid="catalogue-card-placeholder"
      >
        <span
          class="font-formula text-7xl font-bold text-primary-warm-white/20 select-none"
          aria-hidden="true"
        >
          {{ view.title.charAt(0) }}
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-3 px-3">
      <h3
        class="truncate text-xs font-medium text-content-bright lg:text-sm"
        data-testid="catalogue-card-title"
      >
        {{ view.title }}
      </h3>

      <!-- The mark over the artwork already names who answers for this, so the
        line under the title says what it can do, in the same chips production
        uses. -->
      <TagRow
        :tags="view.badges"
        :link-tags="false"
        :fallback-label="view.maker.label"
        data-testid="catalogue-card-badges"
      />
    </div>
  </div>
</template>
