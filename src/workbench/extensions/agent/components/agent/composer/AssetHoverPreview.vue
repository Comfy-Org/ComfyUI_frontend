<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { PopoverAnchor } from 'reka-ui'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

const { name, previewUrl } = defineProps<{
  name: string
  previewUrl?: string
}>()
const { t } = useI18n()
const mode = ref<'closed' | 'hover' | 'interactive' | 'dismissed'>('closed')
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
    if (mode.value === 'interactive') return
    if (mode.value === 'dismissed' && (onTrigger || onContent || pointerInside))
      return
    mode.value = onTrigger || onContent ? 'hover' : 'closed'
  }
)

function activate(): void {
  mode.value = 'interactive'
  content.value?.focus()
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
  if (mode.value === 'interactive') content.value?.focus()
}

function onEscape(): void {
  if (
    mode.value === 'interactive' ||
    content.value?.contains(document.activeElement)
  )
    trigger.value?.focus()
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
      class="z-1700 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-border-subtle bg-secondary-background p-0"
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus.prevent
      @escape-key-down="onEscape"
      @interact-outside="onInteractOutside"
    >
      <div ref="content" tabindex="-1" role="region" :aria-label="name">
        <img
          v-if="previewUrl && getMediaTypeFromFilename(name) === 'image'"
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
