<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import {
  findServerPreviewUrl,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'

import { AssetKindKey } from './types'
import type { FormDropdownMenuItemProps } from './types'

const props = defineProps<FormDropdownMenuItemProps>()

const { t } = useI18n()

const emit = defineEmits<{
  click: [index: number]
  mediaLoad: [event: Event]
}>()

const actualDimensions = ref<string | null>(null)

const assetKind = inject(AssetKindKey)

const isVideo = computed(() => assetKind?.value === 'video')
const isMesh = computed(() => assetKind?.value === 'mesh')
const isAudio = computed(() => assetKind?.value === 'audio')

const mediaContainerRef = ref<HTMLElement>()
const resolvedMeshPreview = ref<string | null>(null)
const meshPreviewAttempted = ref(false)

const audioRef = ref<HTMLAudioElement | null>(null)
const isPlayingAudio = ref(false)

function toLookupName(name: string): string {
  const stripped = name.replace(/ \[output\]$/, '')
  const slash = stripped.lastIndexOf('/')
  return slash === -1 ? stripped : stripped.substring(slash + 1)
}

async function resolveMeshPreview() {
  if (!isAssetPreviewSupported()) return
  const url = await findServerPreviewUrl(toLookupName(props.name))
  if (url) resolvedMeshPreview.value = url
}

useIntersectionObserver(mediaContainerRef, ([entry]) => {
  if (!entry?.isIntersecting) return
  if (!isMesh.value || meshPreviewAttempted.value) return
  meshPreviewAttempted.value = true
  void resolveMeshPreview()
})

watch(
  () => props.name,
  () => {
    meshPreviewAttempted.value = false
    resolvedMeshPreview.value = null
  }
)

const displayedPreviewUrl = computed(() =>
  isMesh.value ? resolvedMeshPreview.value : props.previewUrl
)

function handleClick() {
  emit('click', props.index)
}

function toggleAudioPreview(event: Event) {
  event.stopPropagation()
  const audio = audioRef.value
  if (!audio) return
  if (audio.paused) {
    void audio.play().catch(() => {})
  } else {
    audio.pause()
  }
}

function handleImageLoad(event: Event) {
  emit('mediaLoad', event)
  if (!event.target || !(event.target instanceof HTMLImageElement)) return
  const img = event.target
  if (img.naturalWidth && img.naturalHeight) {
    actualDimensions.value = `${img.naturalWidth} x ${img.naturalHeight}`
  }
}

function handleVideoLoad(event: Event) {
  emit('mediaLoad', event)
  if (!event.target || !(event.target instanceof HTMLVideoElement)) return
  const video = event.target
  if (video.videoWidth && video.videoHeight) {
    actualDimensions.value = `${video.videoWidth} x ${video.videoHeight}`
  }
}
</script>

<template>
  <div
    :class="
      cn(
        'group/item flex cursor-pointer gap-1 bg-component-node-widget-background select-none',
        'transition-[transform,box-shadow,background-color] duration-150',
        {
          'flex-col text-center': layout === 'grid',
          'max-h-16 flex-row rounded-lg text-left hover:scale-102 active:scale-98':
            layout === 'list',
          'flex-row rounded-lg text-left hover:bg-component-node-widget-background-hovered':
            layout === 'list-small',
          // selection
          'ring-2 ring-component-node-widget-background-highlighted':
            layout === 'list' && selected
        }
      )
    "
    @click="handleClick"
  >
    <!-- Image -->
    <div
      v-if="layout !== 'list-small'"
      ref="mediaContainerRef"
      :class="
        cn(
          'relative',
          'aspect-square w-full overflow-hidden outline-1 -outline-offset-1 outline-interface-stroke',
          'transition-[transform,box-shadow] duration-150',
          {
            'max-w-16 min-w-16 rounded-l-lg': layout === 'list',
            'rounded-sm group-hover/item:scale-108 group-active/item:scale-95':
              layout === 'grid',
            // selection
            'ring-2 ring-component-node-widget-background-highlighted':
              layout === 'grid' && selected
          }
        )
      "
    >
      <!-- Selected Icon -->
      <div
        v-if="selected"
        :aria-label="t('g.selected')"
        role="img"
        class="absolute top-1 left-1 size-4 rounded-full border border-base-foreground bg-primary-background"
      >
        <i
          class="bold icon-[lucide--check] size-3 translate-y-[-0.5px] text-base-foreground"
          aria-hidden="true"
        />
      </div>
      <video
        v-if="previewUrl && isVideo"
        :src="previewUrl"
        :aria-label="label ?? name"
        class="size-full object-cover"
        preload="metadata"
        muted
        @loadeddata="handleVideoLoad"
      />
      <button
        v-else-if="previewUrl && isAudio"
        type="button"
        :aria-label="
          isPlayingAudio
            ? t('widgets.remoteCombo.pauseAudioPreview')
            : t('widgets.remoteCombo.playAudioPreview')
        "
        :aria-pressed="isPlayingAudio"
        class="flex size-full cursor-pointer items-center justify-center bg-component-node-widget-background hover:bg-component-node-widget-background-hovered"
        @click.stop="toggleAudioPreview"
      >
        <audio
          ref="audioRef"
          :src="previewUrl"
          preload="none"
          @play="isPlayingAudio = true"
          @pause="isPlayingAudio = false"
          @ended="isPlayingAudio = false"
        />
        <i
          :class="
            cn(
              'text-secondary size-5',
              isPlayingAudio ? 'icon-[lucide--pause]' : 'icon-[lucide--play]'
            )
          "
        />
      </button>
      <img
        v-else-if="displayedPreviewUrl"
        :src="displayedPreviewUrl"
        :alt="name"
        draggable="false"
        class="size-full object-cover"
        @load="handleImageLoad"
      />
      <div
        v-else-if="isMesh"
        data-testid="dropdown-item-mesh-placeholder"
        class="flex size-full items-center justify-center bg-modal-card-placeholder-background"
      >
        <i class="icon-[lucide--box] text-3xl text-muted-foreground" />
      </div>
      <div
        v-else
        data-testid="dropdown-item-media-placeholder"
        class="size-full bg-linear-to-tr from-blue-400 via-teal-500 to-green-400"
      />
    </div>
    <!-- Name -->
    <div
      :class="
        cn('flex gap-1', {
          'flex-col': layout === 'grid',
          'w-full min-w-0 flex-col justify-center px-4 py-1': layout === 'list',
          'w-full flex-row items-center justify-between p-2':
            layout === 'list-small'
        })
      "
    >
      <span
        v-tooltip="layout === 'grid' ? (label ?? name) : undefined"
        :class="
          cn(
            'line-clamp-2 block overflow-hidden text-xs wrap-break-word',
            'transition-colors duration-150',
            // selection
            !!selected && 'text-base-foreground'
          )
        "
      >
        {{ label ?? name }}
      </span>
      <!-- Description -->
      <span
        v-if="description && layout !== 'grid'"
        class="text-secondary line-clamp-1 block overflow-hidden text-xs"
      >
        {{ description }}
      </span>
      <!-- Meta Data -->
      <span v-if="actualDimensions" class="text-secondary block text-xs">
        {{ actualDimensions }}
      </span>
    </div>
  </div>
</template>
