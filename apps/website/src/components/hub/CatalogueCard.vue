<script setup lang="ts">
import { Blocks } from '@lucide/vue'
import { useTemplateRef } from 'vue'

import { usePreviewVideo } from '../../composables/usePreviewVideo'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { CardView } from '../../lib/hub/catalogue-card'
import HubTypeBadge from './HubTypeBadge.vue'

const { view, locale = 'en' } = defineProps<{
  view: CardView
  locale?: Locale
}>()

const video = useTemplateRef<HTMLVideoElement>('video')
const previewSrc = usePreviewVideo(video, () =>
  view.media?.kind === 'video' ? view.media.url : undefined
)
</script>

<template>
  <div
    class="group relative flex flex-col gap-3 rounded-4xl bg-hub-surface px-2 pt-2 pb-4 transition-colors duration-200 hover:bg-hub-surface-hover"
    data-testid="catalogue-card"
    :data-kind="view.kind"
  >
    <a
      :href="view.href"
      class="absolute inset-0 z-10 rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      data-testid="catalogue-card-link"
    >
      <span class="sr-only">{{ view.title }}</span>
    </a>
    <div
      class="relative aspect-4/3 overflow-hidden rounded-3.5xl bg-hub-surface-hover"
    >
      <HubTypeBadge :kind="view.kind" :locale />

      <!-- Said on the card rather than on the page, because it is the one
        thing that decides whether the download is worth starting. -->
      <span
        v-if="view.needsCustomNodes"
        class="pointer-events-none absolute top-4 right-4 z-20 inline-flex h-7 items-center gap-1.5 rounded-lg bg-black/40 px-2 text-2xs/none text-white backdrop-blur-md"
        data-testid="catalogue-card-custom-nodes"
      >
        <Blocks class="size-3.5 shrink-0" aria-hidden="true" />
        {{ t('workshop.v2.card.customNodes', locale) }}
      </span>

      <video
        v-if="view.media?.kind === 'video'"
        ref="video"
        :src="previewSrc"
        :aria-label="view.title"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        muted
        loop
        playsinline
        preload="metadata"
      />
      <template v-else-if="view.media?.kind === 'image'">
        <img
          :src="view.media.url"
          :alt="view.title"
          loading="lazy"
          decoding="async"
          draggable="false"
          class="size-full object-cover transition-transform duration-300 select-none group-hover:scale-105"
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

    <div class="flex flex-col gap-2 px-3">
      <h3
        class="line-clamp-2 text-sm font-medium text-content-bright lg:text-base"
        data-testid="catalogue-card-title"
      >
        {{ view.title }}
      </h3>

      <!-- The title names the job, so the model is what tells one card from
        the next. It stands where the maker would, which on a workflow reads
        `ComfyUI` on every card and so marks none of them. -->
      <span
        v-if="view.model"
        class="inline-flex h-6 w-fit max-w-full items-center rounded-lg bg-transparency-white-t8 px-2 text-xs text-content-secondary"
        data-testid="catalogue-card-model"
      >
        <span class="truncate">{{ view.model }}</span>
      </span>

      <div v-else class="flex items-center gap-3 text-content-secondary">
        <span
          class="flex min-w-0 items-center gap-2"
          data-testid="catalogue-card-maker"
        >
          <span
            v-if="view.maker.logo"
            class="size-4 shrink-0 bg-content-secondary mask-contain mask-center mask-no-repeat"
            :style="{ maskImage: `url(${view.maker.logo})` }"
            aria-hidden="true"
          />
          <span
            v-else
            class="grid size-4 shrink-0 place-items-center rounded-full bg-brand text-2xs font-bold text-page"
            aria-hidden="true"
          >
            {{ view.maker.label.charAt(0).toUpperCase() }}
          </span>
          <span class="truncate text-xs">{{ view.maker.label }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
