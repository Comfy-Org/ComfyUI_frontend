<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import {
  findServerPreviewUrl,
  isAssetPreviewSupported
} from '@/platform/assets/utils/assetPreviewUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import type { FormDropdownMenuItemProps } from './types'

const props = defineProps<FormDropdownMenuItemProps>()

const { t } = useI18n()

const emit = defineEmits<{
  click: [index: number]
  mediaLoad: [event: Event]
}>()

const actualDimensions = ref<string | null>(null)

function toLookupName(name: string): string {
  const stripped = name.replace(/ \[output\]$/, '')
  const slash = stripped.lastIndexOf('/')
  return slash === -1 ? stripped : stripped.substring(slash + 1)
}

const isMesh = computed(
  () => getMediaTypeFromFilename(toLookupName(props.name)) === '3D'
)

const mediaContainerRef = ref<HTMLElement>()
const resolvedMeshPreview = ref<string | null>(null)
const meshPreviewAttempted = ref(false)
const failedSrc = ref<string>()

async function resolveMeshPreview() {
  if (!isAssetPreviewSupported()) return
  const url = await findServerPreviewUrl(toLookupName(props.name))
  if (url) resolvedMeshPreview.value = url
}

useIntersectionObserver(mediaContainerRef, ([entry]) => {
  if (!entry.isIntersecting) return
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

const displayedSrc = computed(() => {
  const src = resolvedMeshPreview.value ?? props.thumbnail.src
  return src && src !== failedSrc.value ? src : undefined
})

function handleClick() {
  emit('click', props.index)
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
        'group/item flex cursor-pointer gap-1 bg-input select-none',
        'transition-[transform,box-shadow,background-color] duration-150',
        {
          'flex-col text-center': layout === 'grid',
          'max-h-16 flex-row rounded-lg text-left hover:scale-102 active:scale-98':
            layout === 'list',
          'flex-row rounded-lg text-left hover:bg-muted':
            layout === 'list-small',
          // selection
          'ring-2 ring-muted-foreground': layout === 'list' && selected
        },
        candidate && !selected && layout !== 'grid' && 'bg-muted'
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
          'aspect-square w-full overflow-hidden outline-1 -outline-offset-1 outline-border',
          'transition-[transform,box-shadow] duration-150',
          {
            'max-w-16 min-w-16 rounded-l-lg': layout === 'list',
            'rounded-sm group-hover/item:scale-108 group-active/item:scale-95':
              layout === 'grid',
            // selection
            'ring-2 ring-muted-foreground':
              layout === 'grid' && (selected || candidate)
          }
        )
      "
    >
      <!-- Selected Icon -->
      <div
        v-if="selected"
        :aria-label="t('g.selected')"
        role="img"
        class="absolute top-1 left-1 size-4 rounded-full border border-foreground bg-foreground"
      >
        <i
          class="bold icon-[lucide--check] size-3 translate-y-[-0.5px] text-background"
          aria-hidden="true"
        />
      </div>
      <video
        v-if="displayedSrc && thumbnail.isVideo"
        :src="displayedSrc"
        :aria-label="label ?? name"
        class="size-full object-cover"
        preload="metadata"
        muted
        @loadeddata="handleVideoLoad"
        @error="failedSrc = displayedSrc"
      />
      <img
        v-else-if="displayedSrc"
        :src="displayedSrc"
        :alt="name"
        draggable="false"
        class="size-full object-cover"
        @load="handleImageLoad"
        @error="failedSrc = displayedSrc"
      />
      <div
        v-else
        data-testid="dropdown-item-media-placeholder"
        class="flex size-full items-center justify-center bg-muted"
      >
        <i :class="cn(thumbnail.icon, 'size-8 text-muted-foreground')" />
      </div>
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
      <Tooltip :disabled="layout !== 'grid'">
        <TooltipTrigger as-child>
          <span
            :class="
              cn(
                'line-clamp-2 block overflow-hidden text-xs wrap-break-word',
                'transition-colors duration-150',
                // selection
                !!selected && 'text-foreground'
              )
            "
          >
            {{ label ?? name }}
          </span>
        </TooltipTrigger>
        <TooltipContent>{{ label ?? name }}</TooltipContent>
      </Tooltip>
      <!-- Meta Data -->
      <span v-if="actualDimensions" class="block text-xs text-muted-foreground">
        {{ actualDimensions }}
      </span>
    </div>
  </div>
</template>
