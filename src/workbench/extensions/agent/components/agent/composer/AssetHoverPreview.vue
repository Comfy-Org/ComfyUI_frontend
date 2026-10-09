<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { PopoverAnchor } from 'reka-ui'
import { computed, onBeforeUnmount, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ComponentInstance } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import AssetMediaPreview from './AssetMediaPreview.vue'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import type { AssetPreviewMode } from '../../../types/assetPreview'

const { name, previewUrl, mediaUrl, mediaKind } = defineProps<{
  name: string
  previewUrl?: string
  mediaUrl?: string
  mediaKind?: MediaKind
}>()
const { t } = useI18n()
const kind = computed(() => mediaKind ?? getMediaTypeFromFilename(name))
const playableKind = computed(() =>
  kind.value === 'video' || kind.value === 'audio' ? kind.value : undefined
)
const player =
  useTemplateRef<ComponentInstance<typeof AssetMediaPreview>>('player')
const mode = defineModel<AssetPreviewMode>('mode', { default: 'closed' })
const open = computed(
  () => mode.value === 'hover' || mode.value === 'interactive'
)
const contentId = useId()
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const content = useTemplateRef<HTMLDivElement>('content')
const triggerPointerInside = useElementHover(trigger)
const triggerHovered = useElementHover(trigger, {
  delayEnter: 250,
  delayLeave: 150
})
const contentHovered = useElementHover(content, {
  delayLeave: 150,
  triggerOnRemoval: true
})
const contentStyle = useModalLiftedZIndex(open)

watch(
  [triggerHovered, contentHovered, triggerPointerInside],
  ([onTrigger, onContent, pointerInside]) => {
    const hovering = onTrigger || onContent
    const acceptsHoverUpdate: Record<AssetPreviewMode, boolean> = {
      closed: onTrigger && pointerInside,
      hover: true,
      interactive: false,
      dismissed: !hovering && !pointerInside
    }
    if (acceptsHoverUpdate[mode.value])
      mode.value = hovering ? 'hover' : 'closed'
  }
)
onBeforeUnmount(() => {
  mode.value = 'closed'
})

function focusPreview(): void {
  if (player.value) player.value.focus()
  else content.value?.focus()
}

function activate(): void {
  mode.value = 'interactive'
  focusPreview()
}

function onOpenChange(next: boolean): void {
  if (!next)
    mode.value =
      triggerPointerInside.value || contentHovered.value
        ? 'dismissed'
        : 'closed'
}

function onOpenAutoFocus(event: Event): void {
  event.preventDefault()
  if (mode.value === 'interactive') focusPreview()
}

function onEscape(): void {
  const restoreFocus =
    mode.value === 'interactive' ||
    content.value?.contains(document.activeElement)
  mode.value = 'dismissed'
  if (restoreFocus) trigger.value?.focus()
}

function onInteractOutside(event: Event): void {
  if (event.target instanceof Node && trigger.value?.contains(event.target))
    event.preventDefault()
}
</script>

<template>
  <Popover :open @update:open="onOpenChange">
    <PopoverAnchor as-child>
      <button
        ref="trigger"
        type="button"
        :aria-label="t('agent.previewAsset', { name })"
        aria-haspopup="dialog"
        :aria-expanded="open"
        :aria-controls="open ? contentId : undefined"
        class="relative flex size-full cursor-pointer items-center justify-center overflow-hidden rounded-md hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
        @click="activate"
      >
        <slot />
      </button>
    </PopoverAnchor>
    <PopoverContent
      :id="contentId"
      :aria-label="name"
      side="top"
      align="start"
      :side-offset="8"
      :collision-padding="16"
      :style="contentStyle"
      :class="
        cn(
          'z-1700 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-border-subtle bg-secondary-background p-0',
          playableKind === 'audio' ? 'w-86' : 'w-80'
        )
      "
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus.prevent
      @escape-key-down="onEscape"
      @interact-outside="onInteractOutside"
    >
      <div ref="content" tabindex="-1" role="region" :aria-label="name">
        <AssetMediaPreview
          v-if="mediaUrl && playableKind"
          :key="playableKind"
          ref="player"
          :name
          :media-url
          :kind="playableKind"
          :poster-url="previewUrl"
          :active="open"
        />
        <img
          v-else-if="previewUrl && (kind === 'image' || kind === 'video')"
          :src="previewUrl"
          :alt="name"
          class="max-h-80 w-full object-contain"
        />
        <div class="px-3 py-2 text-sm wrap-anywhere text-base-foreground">
          {{ name }}
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
