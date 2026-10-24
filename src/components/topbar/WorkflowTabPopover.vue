<template>
  <Popover v-model:open="open">
    <PopoverAnchor as="template" :reference="anchor ?? undefined" />
    <PopoverContent
      side="bottom"
      :side-offset="8"
      class="workflow-popover-fade w-fit rounded-xl border-none bg-transparent p-0 shadow-lg transition-opacity duration-150 ease-out data-[state=closed]:animate-none data-[state=open]:animate-none"
      :collision-padding="8"
      @open-auto-focus="!clicked && $event.preventDefault()"
      @close-auto-focus.prevent="restoreFocus"
      @interact-outside="onInteractOutside"
      @mouseenter="stopHide"
      @mouseleave="hidePopover"
    >
      <div
        class="flex max-w-62.5 flex-col overflow-hidden rounded-xl bg-popover text-foreground"
      >
        <div
          v-if="thumbnailUrl && !isActiveTab"
          class="workflow-preview-thumbnail relative p-2"
        >
          <img
            :src="thumbnailUrl"
            class="block h-50 rounded-lg bg-secondary object-cover p-2 shadow-lg"
            :style="{ width: `${POPOVER_WIDTH}px` }"
          />
        </div>
        <div class="px-3 pt-1 pb-2">
          <span class="block truncate text-sm font-medium">
            {{ workflowFilename }}
          </span>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { PopoverAnchor } from 'reka-ui'
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import { ref, toRefs, watch } from 'vue'

import { usePopoverViewportDismiss } from '@/components/ui/popover/usePopoverViewportDismiss'

const POPOVER_WIDTH = 250

interface Props {
  anchor: HTMLElement | null
  hovered: boolean
  workflowFilename: string
  thumbnailUrl?: string
  isActiveTab: boolean
}

const props = defineProps<Props>()
const { thumbnailUrl, isActiveTab } = toRefs(props)
const open = defineModel<boolean>('open', { default: false })
const clicked = defineModel<boolean>('clicked', { default: false })
const outside = ref(false)
watch(open, (value) => {
  stopShow()
  stopHide()
  if (value) outside.value = false
})
const { start: startShow, stop: stopShow } = useTimeoutFn(
  () => {
    clicked.value = false
    open.value = true
  },
  200,
  { immediate: false }
)
const { start: startHide, stop: stopHide } = useTimeoutFn(
  () => {
    open.value = false
  },
  100,
  { immediate: false }
)
function showPopover() {
  stopHide()
  startShow()
}
function hidePopover() {
  stopShow()
  startHide()
}
function restoreFocus() {
  if (clicked.value && !outside.value)
    props.anchor?.querySelector<HTMLElement>('[role="tab"]')?.focus()
}
function onInteractOutside(event: FocusOutsideEvent | PointerDownOutsideEvent) {
  const target = event.detail.originalEvent.target
  if (target instanceof Node && props.anchor?.contains(target)) {
    event.preventDefault()
  } else {
    outside.value = true
  }
}
watch(
  () => props.hovered,
  (hovered) => {
    if (hovered) showPopover()
    else hidePopover()
  }
)
usePopoverViewportDismiss(open, () => props.anchor)
</script>
