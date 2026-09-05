<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { resolveTemplateLogos } from '../../lib/hub/model-logos'
import { hubCreatorUrl } from '../../lib/hub/routes'
import type { HubTemplate } from '../../lib/hub/types'
import TagRow from './TagRow.vue'

const { template, href, tryNowLabel } = defineProps<{
  template: HubTemplate
  href: string
  tryNowLabel: string
}>()

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  '3d': '3D'
}

const modelLogos = computed(() =>
  resolveTemplateLogos({
    logos: template.logos,
    models: template.models
  }).slice(0, 3)
)
const authorName = computed(() => template.username || 'ComfyUI')
const creatorUrl = computed(() => hubCreatorUrl(authorName.value))
const external = computed(() => href.startsWith('http'))

const primaryUrl = computed(() => template.thumbnails[0] ?? null)
const secondaryUrl = computed(() => template.thumbnails[1] ?? null)
const showCompare = computed(
  () =>
    template.thumbnailVariant === 'compareSlider' &&
    Boolean(primaryUrl.value && secondaryUrl.value)
)
const showHoverDissolve = computed(
  () =>
    template.thumbnailVariant === 'hoverDissolve' &&
    Boolean(primaryUrl.value && secondaryUrl.value)
)
const showZoomHover = computed(
  () =>
    (template.thumbnailVariant === 'zoomHover' ||
      template.thumbnailVariant === 'hoverZoom') &&
    Boolean(primaryUrl.value)
)

const compareRoot = ref<HTMLElement | null>(null)
const comparePosition = ref(50)

function onCompareMove(event: PointerEvent) {
  const el = compareRoot.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  comparePosition.value = Math.min(
    100,
    Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)
  )
}

onMounted(() =>
  compareRoot.value?.addEventListener('pointermove', onCompareMove)
)
onUnmounted(() =>
  compareRoot.value?.removeEventListener('pointermove', onCompareMove)
)

function openCard() {
  if (external.value) window.open(href, '_blank', 'noopener')
  else window.location.href = href
}
</script>

<template>
  <div
    class="group/pill-trigger group content-auto bg-hub-surface hover:bg-hub-surface-hover flex cursor-pointer flex-col gap-4 overflow-hidden rounded-4xl px-2 pt-2 pb-6 transition-colors duration-200"
    data-testid="hub-card"
    :data-app="template.isApp"
    @click="openCard"
  >
    <div
      class="bg-hub-surface relative aspect-4/3 overflow-hidden rounded-[1.75rem]"
    >
      <div
        v-if="showCompare"
        ref="compareRoot"
        class="relative size-full overflow-hidden"
      >
        <img
          :src="primaryUrl ?? ''"
          :alt="`${template.title} - After`"
          loading="lazy"
          decoding="async"
          draggable="false"
          class="size-full object-cover select-none"
        />
        <div
          class="absolute inset-0 overflow-hidden"
          :style="{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }"
        >
          <img
            :src="secondaryUrl ?? ''"
            :alt="`${template.title} - Before`"
            loading="lazy"
            decoding="async"
            draggable="false"
            class="size-full object-cover select-none"
          />
        </div>
        <div
          class="absolute inset-y-0 w-1 cursor-ew-resize bg-white shadow-lg"
          :style="{ left: `${comparePosition}%` }"
          aria-hidden="true"
        />
      </div>
      <div
        v-else-if="showHoverDissolve"
        class="group/thumb relative size-full overflow-hidden"
      >
        <img
          :src="primaryUrl ?? ''"
          :alt="`${template.title} - 1`"
          loading="lazy"
          decoding="async"
          draggable="false"
          class="size-full object-cover transition-opacity duration-500 select-none"
        />
        <img
          :src="secondaryUrl ?? ''"
          :alt="`${template.title} - 2`"
          loading="lazy"
          decoding="async"
          draggable="false"
          class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 select-none group-hover/thumb:opacity-100"
        />
      </div>
      <img
        v-else-if="primaryUrl"
        :src="primaryUrl"
        :alt="template.title"
        loading="lazy"
        decoding="async"
        draggable="false"
        :class="
          cn(
            'size-full object-cover transition-transform select-none',
            showZoomHover
              ? 'duration-500 group-hover:scale-125'
              : 'duration-300 group-hover:scale-105'
          )
        "
      />
      <div
        v-else
        class="flex size-full items-center justify-center bg-linear-to-br from-white/5 to-white/10"
      >
        <svg
          class="text-content/20 size-10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
      </div>

      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/30 to-transparent"
        aria-hidden="true"
      />
      <h3
        class="text-content-bright pointer-events-none absolute inset-x-5 bottom-5 z-10 line-clamp-2 text-base leading-[1.3] font-medium drop-shadow-md sm:text-lg lg:text-xl"
      >
        <a
          :href="href"
          :target="external ? '_blank' : undefined"
          :rel="external ? 'noopener' : undefined"
          class="pointer-events-auto"
          data-testid="hub-card-link"
          @click.stop
        >
          {{ template.title }}
        </a>
      </h3>
      <div
        v-if="modelLogos.length"
        :class="
          cn(
            'absolute top-4 right-4 z-10 flex items-center justify-center gap-1 rounded-2xl bg-transparency-white-t8 backdrop-blur-sm',
            modelLogos.length > 1 ? 'h-10 w-auto px-2' : 'size-10'
          )
        "
      >
        <span
          v-for="logo in modelLogos"
          :key="logo.name"
          :title="logo.name"
          role="img"
          :aria-label="logo.name"
          class="size-5 bg-white mask-contain mask-center mask-no-repeat"
          :style="{ maskImage: `url(${logo.src})` }"
        />
      </div>
    </div>

    <div class="flex flex-col gap-4 px-4">
      <div class="flex items-center justify-between gap-2">
        <a
          :href="creatorUrl"
          target="_blank"
          rel="noopener"
          class="text-content-secondary hover:text-content flex w-fit min-w-0 items-center gap-2"
          @click.stop
        >
          <span
            class="bg-brand text-page grid size-5 shrink-0 place-items-center rounded-full text-2xs font-bold"
            aria-hidden="true"
          >
            {{ authorName.charAt(0).toUpperCase() }}
          </span>
          <span class="ppformula-text-center-sm truncate text-base">{{
            authorName
          }}</span>
        </a>
        <a
          :href="href"
          :target="external ? '_blank' : undefined"
          :rel="external ? 'noopener' : undefined"
          :aria-label="template.title"
          class="text-content group-hover/pill-trigger:bg-primary-comfy-yellow relative isolate inline-flex h-10 w-fit shrink-0 cursor-pointer items-center overflow-hidden rounded-2xl bg-transparent ps-9 pe-0 text-sm font-bold tracking-wider text-nowrap uppercase transition-all duration-500 group-hover/pill-trigger:pe-5 group-hover/pill-trigger:text-primary-comfy-ink"
          @click.stop
        >
          <span
            class="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 group-hover/pill-trigger:grid-cols-[1fr]"
          >
            <span class="overflow-hidden">
              <span class="ppformula-text-center relative leading-none">{{
                tryNowLabel
              }}</span>
            </span>
          </span>
          <span
            class="group-hover/pill-trigger:bg-primary-comfy-yellow absolute top-1/2 left-1 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-xl bg-white/20 text-white transition-all duration-500 group-hover/pill-trigger:text-primary-comfy-ink"
            aria-hidden="true"
          >
            <ChevronRight class="size-4" :stroke-width="2" />
          </span>
        </a>
      </div>
      <TagRow
        :tags="template.tags"
        :fallback-label="MEDIA_TYPE_LABELS[template.mediaType] ?? ''"
      />
    </div>
  </div>
</template>
