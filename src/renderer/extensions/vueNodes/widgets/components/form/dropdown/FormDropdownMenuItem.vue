<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import CategoryPlaceholder from '@/components/sidebar/tabs/cloudModelLibrary/CategoryPlaceholder.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
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

const assetKind = inject(AssetKindKey)

const isVideo = computed(() => assetKind?.value === 'video')
const isMesh = computed(() => assetKind?.value === 'mesh')
const isModel = computed(() => assetKind?.value === 'model')

// Mesh previews aren't served inline; resolve them lazily once the row is
// scrolled into view.
const mediaContainerRef = ref<HTMLElement>()
const resolvedMeshPreview = ref<string | null>(null)
const meshPreviewAttempted = ref(false)

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

const displayedPreviewUrl = computed(() =>
  isMesh.value ? resolvedMeshPreview.value : props.previewUrl
)

const baseModelLabel = computed(() => props.baseModels?.join(' · ') ?? '')
const metaLabel = computed(() =>
  [baseModelLabel.value, props.author].filter(Boolean).join(' · ')
)

// Media values carry a trailing source annotation like " [output]". It isn't
// part of the file type, and grid cards are too narrow to show it in the name.
const SOURCE_LABEL_RE = /\s*\[[^\]]+\]\s*$/

const fileType = computed(() => {
  const fileName = props.name.replace(SOURCE_LABEL_RE, '')
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : ''
})

const displayName = computed(() => {
  const base = props.label ?? props.name
  return props.layout === 'grid' ? base.replace(SOURCE_LABEL_RE, '') : base
})

const mediaLoaded = ref(false)
const dimensions = ref('')

// Secondary line under the name. Models surface their base model and author;
// media surfaces the file type and pixel dimensions.
const detailItems = computed(() =>
  metaLabel.value
    ? [metaLabel.value]
    : [fileType.value, dimensions.value].filter(Boolean)
)
const hasDetails = computed(() => detailItems.value.length > 0)

// Cloud model rows let long names run to a second line; media rows stay
// single-line when they carry a file-type/dimensions subheading.
const wrapTitle = computed(() => isModel.value || !hasDetails.value)

watch(
  () => props.previewUrl,
  () => {
    mediaLoaded.value = false
    dimensions.value = ''
  }
)

watch(
  () => props.name,
  () => {
    meshPreviewAttempted.value = false
    resolvedMeshPreview.value = null
  }
)

function handleClick() {
  emit('click', props.index)
}

function handleMediaLoad(event: Event) {
  mediaLoaded.value = true
  const target = event.target
  if (target instanceof HTMLImageElement && target.naturalWidth > 0) {
    dimensions.value = `${target.naturalWidth}×${target.naturalHeight}`
  } else if (target instanceof HTMLVideoElement && target.videoWidth > 0) {
    dimensions.value = `${target.videoWidth}×${target.videoHeight}`
  }
  emit('mediaLoad', event)
}
</script>

<template>
  <div
    :class="
      cn(
        'group/item relative flex cursor-pointer gap-1 select-none',
        'transition-[transform,box-shadow,background-color] duration-150',
        {
          'flex-col pb-2 text-left': layout === 'grid',
          'flex-row items-center rounded-lg p-1 text-left hover:bg-component-node-widget-background':
            layout === 'list',
          'h-10 flex-row items-center rounded-lg text-left hover:bg-component-node-widget-background':
            layout === 'list-small',
          'bg-component-node-widget-background-selected':
            (layout === 'list' || layout === 'list-small') && selected
        },
        candidate &&
          !selected &&
          layout !== 'grid' &&
          'bg-component-node-widget-background-hovered'
      )
    "
    @click="handleClick"
  >
    <!-- Screen-reader selection cue for list rows (grid uses the check badge) -->
    <span
      v-if="selected && layout !== 'grid'"
      :aria-label="t('g.selected')"
      role="img"
      class="sr-only"
    />
    <!-- Image -->
    <div
      v-if="layout !== 'list-small'"
      ref="mediaContainerRef"
      :class="
        cn(
          'relative overflow-hidden transition-[transform,box-shadow] duration-150',
          {
            'aspect-square w-full rounded-sm outline-1 -outline-offset-1 outline-interface-stroke group-hover/item:ring-2 group-hover/item:ring-component-node-widget-background-highlighted group-active/item:scale-95':
              layout === 'grid',
            'ring-2 ring-component-node-widget-background-highlighted':
              layout === 'grid' && (selected || candidate),
            'size-14 shrink-0 rounded-sm': layout === 'list',
            'border-2 border-base-foreground': layout === 'list' && selected
          }
        )
      "
    >
      <!-- Selected check badge (grid) -->
      <div
        v-if="selected && layout === 'grid'"
        :aria-label="t('g.selected')"
        role="img"
        class="absolute top-1 left-1 flex size-4 items-center justify-center rounded-full border border-base-foreground bg-primary-background"
      >
        <i
          class="icon-[lucide--check] size-3 text-base-foreground"
          aria-hidden="true"
        />
      </div>
      <Skeleton
        v-if="displayedPreviewUrl && !mediaLoaded"
        class="absolute inset-0"
      />
      <video
        v-if="displayedPreviewUrl && isVideo"
        :src="displayedPreviewUrl"
        :aria-label="label ?? name"
        class="size-full object-cover transition-opacity duration-150"
        :class="mediaLoaded ? 'opacity-100' : 'opacity-0'"
        preload="metadata"
        muted
        @loadeddata="handleMediaLoad"
      />
      <img
        v-else-if="displayedPreviewUrl"
        :src="displayedPreviewUrl"
        :alt="name"
        draggable="false"
        class="size-full object-cover transition-opacity duration-150"
        :class="mediaLoaded ? 'opacity-100' : 'opacity-0'"
        @load="handleMediaLoad"
      />
      <div
        v-else-if="isMesh"
        data-testid="dropdown-item-mesh-placeholder"
        class="flex size-full items-center justify-center bg-modal-card-placeholder-background"
      >
        <i class="icon-[lucide--box] text-3xl text-muted-foreground" />
      </div>
      <CategoryPlaceholder
        v-else-if="placeholderCategory"
        :category="placeholderCategory"
      />
      <div
        v-else
        class="flex size-full items-center justify-center bg-muted-background text-muted-foreground"
      >
        <i class="icon-[comfy--ai-model] size-6" />
      </div>
    </div>
    <!-- Compact leading icon for list-small rows (e.g. the local model picker) -->
    <div
      v-if="layout === 'list-small'"
      class="ml-1.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-component-node-widget-background text-muted-foreground group-hover/item:bg-node-component-surface"
    >
      <img
        v-if="displayedPreviewUrl"
        :src="displayedPreviewUrl"
        :alt="name"
        draggable="false"
        class="size-full object-cover"
      />
      <i v-else class="icon-[comfy--ai-model] size-4" />
    </div>
    <!-- Name + details -->
    <div
      :class="
        cn('flex gap-1', {
          'w-full min-w-0 flex-col': layout === 'grid',
          'min-w-0 flex-1 flex-col justify-center pr-1 pl-2': layout === 'list',
          'min-w-0 flex-1 flex-row items-center pr-3 pl-2':
            layout === 'list-small'
        })
      "
    >
      <span
        v-tooltip="
          layout === 'grid' || layout === 'list' ? displayName : undefined
        "
        :class="
          cn(
            'transition-colors duration-150',
            layout === 'list-small'
              ? 'line-clamp-2 min-w-0 text-xs font-normal break-all'
              : 'w-full text-xs font-normal text-base-foreground',
            layout === 'grid' && 'block truncate pr-1',
            layout === 'list' &&
              (wrapTitle ? 'line-clamp-2' : 'block truncate'),
            !!selected && 'text-base-foreground'
          )
        "
      >
        {{ displayName }}
      </span>
      <div
        v-if="(layout === 'grid' || layout === 'list') && detailItems.length"
        :class="
          cn(
            'flex w-full items-center text-muted-foreground',
            layout === 'grid'
              ? 'justify-between gap-2 pr-1 text-2xs'
              : 'gap-1 text-xs'
          )
        "
      >
        <span
          v-for="(detail, i) in detailItems"
          :key="i"
          :class="i === 0 ? 'truncate' : 'shrink-0'"
        >
          {{ detail }}
        </span>
      </div>
    </div>
  </div>
</template>
