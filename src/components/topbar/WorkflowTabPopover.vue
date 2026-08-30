<template>
  <div
    ref="positionRef"
    class="absolute bottom-0 left-1/2 -translate-x-1/2"
  ></div>
  <Popover
    ref="popoverRef"
    side="top"
    :side-offset="8"
    content-class="workflow-popover-fade w-fit rounded-xl border-none bg-transparent p-0 shadow-lg transition-opacity duration-150 ease-out"
    @mouseleave="hidePopover"
  >
    <div
      class="flex max-w-62.5 flex-col overflow-hidden rounded-xl bg-interface-menu-surface text-text-primary"
    >
      <div
        v-if="thumbnailUrl && !isActiveTab"
        class="workflow-preview-thumbnail relative p-2"
      >
        <img
          :src="thumbnailUrl"
          class="bg-interface-menu-component-surface block h-50 rounded-lg object-cover p-2 shadow-lg"
          :style="{ width: `${POPOVER_WIDTH}px` }"
        />
      </div>
      <div class="px-3 pt-1 pb-2">
        <span class="block truncate text-sm font-medium text-text-primary">
          {{ workflowFilename }}
        </span>
      </div>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import Popover from '@/components/ui/popover/PopoverOverlay.vue'
import { ref, toRefs } from 'vue'

const POPOVER_WIDTH = 250

interface Props {
  workflowFilename: string
  thumbnailUrl?: string
  isActiveTab: boolean
}

const props = defineProps<Props>()
const { thumbnailUrl, isActiveTab } = toRefs(props)
const popoverRef = ref<InstanceType<typeof Popover> | null>(null)
const positionRef = ref<HTMLElement | null>(null)
let hideTimeout: ReturnType<typeof setTimeout> | null = null
let showTimeout: ReturnType<typeof setTimeout> | null = null

const showPopover = (event: Event) => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }

  showTimeout = setTimeout(() => {
    if (popoverRef.value && positionRef.value) {
      popoverRef.value.show(event, positionRef.value)
    }
  }, 200)
}

const hidePopover = () => {
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }

  hideTimeout = setTimeout(() => {
    if (popoverRef.value) {
      popoverRef.value.hide()
    }
  }, 100)
}

const togglePopover = (event: Event) => {
  if (popoverRef.value) {
    popoverRef.value.toggle(event)
  }
}

defineExpose({
  showPopover,
  hidePopover,
  togglePopover
})
</script>
