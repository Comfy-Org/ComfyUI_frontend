<script setup lang="ts">
import { useTemplateRefsList, useTimeoutFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { lockScroll, unlockScroll } from '../../composables/useScrollLock'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { GalleryItem } from './GallerySection.vue'

const {
  items,
  initialIndex = 0,
  locale = 'en'
} = defineProps<{
  items: GalleryItem[]
  initialIndex?: number
  locale?: Locale
}>()

const emit = defineEmits<{ close: [] }>()

const activeIndex = ref(initialIndex)
const transitioning = ref(false)
const thumbnailRefs = useTemplateRefsList<HTMLButtonElement>()

const activeItem = computed(() => items[activeIndex.value])

function scrollToActiveThumbnail() {
  void nextTick(() => {
    thumbnailRefs.value[activeIndex.value]?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
      block: 'nearest',
      inline: 'center'
    })
  })
}

watch(activeIndex, scrollToActiveThumbnail)

let pendingIndex = -1

const { start: startFadeIn, stop: stopFadeIn } = useTimeoutFn(
  () => {
    transitioning.value = false
  },
  50,
  { immediate: false }
)

const { start: startFadeOut, stop: stopFadeOut } = useTimeoutFn(
  () => {
    activeIndex.value = pendingIndex
    startFadeIn()
  },
  200,
  { immediate: false }
)

function selectThumbnail(index: number) {
  if (index === activeIndex.value || transitioning.value) return
  stopFadeOut()
  stopFadeIn()
  pendingIndex = index
  transitioning.value = true
  startFadeOut()
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowLeft' && activeIndex.value > 0)
    selectThumbnail(activeIndex.value - 1)
  if (e.key === 'ArrowRight' && activeIndex.value < items.length - 1)
    selectThumbnail(activeIndex.value + 1)
}

watch(
  () => initialIndex,
  (val) => {
    activeIndex.value = val
  }
)

const dialogRef = ref<HTMLDialogElement>()

onMounted(() => {
  lockScroll()
  dialogRef.value?.showModal()
  scrollToActiveThumbnail()
})

onUnmounted(() => {
  unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      :aria-label="activeItem.title"
      class="fixed inset-0 z-50 flex size-full max-h-none max-w-none flex-col items-center justify-between border-0 bg-transparent px-4 py-8 backdrop-blur-xl backdrop:bg-transparent lg:px-20 lg:py-8"
      @click="handleBackdropClick"
      @keydown="handleKeydown"
      @close="emit('close')"
    >
      <!-- Close button -->
      <button
        aria-label="Close"
        class="border-primary-comfy-yellow bg-primary-comfy-ink hover:bg-primary-comfy-yellow group absolute right-10 z-10 flex size-10 cursor-pointer items-center justify-center rounded-2xl border-2 transition-colors lg:top-8 lg:right-26"
        @click="emit('close')"
      >
        <span
          class="bg-primary-comfy-yellow group-hover:bg-primary-comfy-ink size-5 transition-colors"
          style="mask: url('/icons/close.svg') center / contain no-repeat"
        />
      </button>

      <!-- Desktop layout -->
      <div
        class="relative hidden w-full items-start pt-12 lg:flex"
        style="max-height: calc(100vh - 13rem)"
      >
        <!-- Left: info card -->
        <div
          class="bg-primary-comfy-yellow text-primary-comfy-ink rounded-5xl relative z-10 flex w-80 shrink-0 flex-col justify-between self-start p-8"
        >
          <div
            :class="transitioning ? 'opacity-0' : 'opacity-100'"
            class="gap-4 transition-opacity duration-200"
          >
            <h2 class="text-2xl font-bold">{{ activeItem.title }}</h2>
            <p class="mt-2 text-xs">
              {{ t('gallery.card.by', locale) }}
              <span class="font-bold">{{ activeItem.userAlias }}</span>
              <template v-if="activeItem.teamAlias">
                {{ t('gallery.card.and', locale) }}
                <span class="font-bold">{{ activeItem.teamAlias }}</span>
                {{ t('gallery.card.teamUsing', locale) }}
              </template>
              <template v-else> using </template>
              <span class="font-bold">{{ activeItem.tool }}</span>
            </p>
          </div>
          <a
            :href="activeItem.href"
            class="border-primary-comfy-ink hover:bg-primary-comfy-ink hover:text-primary-comfy-yellow mt-24 inline-flex items-center justify-center rounded-full border-2 px-6 py-3 text-sm font-bold tracking-wider uppercase transition-colors"
          >
            {{ t('gallery.detail.visitHub', locale) }}
          </a>
        </div>

        <!-- Node link connector (horizontal) -->
        <img
          src="/icons/node-link.svg"
          alt=""
          class="relative top-15 z-20 -mx-px h-6"
        />

        <!-- Right: large image -->
        <div
          class="border-primary-comfy-yellow bg-primary-comfy-ink rounded-5xl flex max-h-full min-h-0 flex-1 items-center justify-center overflow-hidden border-2 p-4"
        >
          <component
            :is="activeItem.video ? 'video' : 'img'"
            :key="activeItem.video ?? activeItem.image"
            :src="activeItem.video ?? activeItem.image"
            :alt="activeItem.video ? undefined : activeItem.title"
            v-bind="
              activeItem.video
                ? { autoplay: true, loop: true, muted: true, playsinline: true }
                : {}
            "
            :class="transitioning ? 'opacity-0' : 'opacity-100'"
            class="mx-auto max-h-full max-w-full rounded-4xl object-contain transition-opacity duration-200"
          />
        </div>
      </div>

      <!-- Mobile layout -->
      <div
        class="flex w-full flex-1 flex-col items-center justify-between pt-12 lg:hidden"
        style="max-height: calc(100vh - 9.5rem)"
      >
        <!-- Image -->
        <div
          class="border-primary-comfy-yellow bg-primary-comfy-ink flex w-full flex-1 items-center overflow-hidden rounded-4xl border-2 p-3"
        >
          <component
            :is="activeItem.video ? 'video' : 'img'"
            :key="activeItem.video ?? activeItem.image"
            :src="activeItem.video ?? activeItem.image"
            :alt="activeItem.video ? undefined : activeItem.title"
            v-bind="
              activeItem.video
                ? { autoplay: true, loop: true, muted: true, playsinline: true }
                : {}
            "
            :class="transitioning ? 'opacity-0' : 'opacity-100'"
            class="mx-auto max-h-full max-w-full rounded-3xl object-contain transition-opacity duration-200"
          />
        </div>

        <!-- Node link connector (vertical) -->
        <img
          src="/icons/node-link.svg"
          alt=""
          class="relative z-20 -my-1 w-2 rotate-90"
        />

        <!-- Info card -->
        <div
          class="bg-primary-comfy-yellow text-primary-comfy-ink w-full rounded-4xl p-6"
        >
          <div
            :class="transitioning ? 'opacity-0' : 'opacity-100'"
            class="transition-opacity duration-200"
          >
            <h2 class="text-xl font-bold">{{ activeItem.title }}</h2>
            <p class="mt-2 text-xs">
              {{ t('gallery.card.by', locale) }}
              <span class="font-bold">{{ activeItem.userAlias }}</span>
              <template v-if="activeItem.teamAlias">
                {{ t('gallery.card.and', locale) }}
                <span class="font-bold">{{ activeItem.teamAlias }}</span>
                {{ t('gallery.card.teamUsing', locale) }}
              </template>
              <template v-else> using </template>
              <span class="font-bold">{{ activeItem.tool }}</span>
            </p>
          </div>
          <a
            :href="activeItem.href"
            class="border-primary-comfy-ink hover:bg-primary-comfy-ink hover:text-primary-comfy-yellow mt-6 inline-flex w-full items-center justify-center rounded-full border-2 px-6 py-3 text-sm font-bold tracking-wider uppercase transition-colors"
          >
            {{ t('gallery.detail.visitHub', locale) }}
          </a>
        </div>
      </div>

      <!-- Thumbnail strip -->
      <div class="scrollbar-none mx-auto mt-6 max-w-full overflow-x-auto px-6">
        <div class="flex items-end gap-3">
          <button
            v-for="(item, i) in items"
            :ref="thumbnailRefs.set"
            :key="i"
            class="shrink-0 cursor-pointer overflow-hidden rounded-xl border-0 bg-transparent p-0 transition-all duration-200"
            :class="
              i === activeIndex
                ? 'ring-primary-comfy-yellow size-16 ring-2 lg:size-30'
                : 'size-12 opacity-70 hover:opacity-100 lg:size-22.5'
            "
            @click="selectThumbnail(i)"
          >
            <video
              v-if="item.video"
              :src="item.video"
              muted
              playsinline
              class="size-full object-cover"
            />
            <img
              v-else
              :src="item.image"
              :alt="item.title"
              class="size-full object-cover"
            />
          </button>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>
