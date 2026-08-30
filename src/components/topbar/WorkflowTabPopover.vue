<template>
  <div
    ref="positionRef"
    class="absolute bottom-0 left-1/2 -translate-x-1/2"
  ></div>
  <Popover
    ref="popoverRef"
    side="top"
    :side-offset="8"
    content-class="workflow-popover-fade w-fit border-none bg-transparent p-0"
    @mouseleave="hidePopover"
  >
    <div class="workflow-preview-content">
      <div
        v-if="thumbnailUrl && !isActiveTab"
        class="workflow-preview-thumbnail relative"
      >
        <img
          :src="thumbnailUrl"
          class="block h-[200px] rounded-lg object-cover p-2"
          :style="{ width: `${POPOVER_WIDTH}px` }"
        />
      </div>
      <div class="workflow-preview-footer">
        <span class="workflow-preview-name">{{ workflowFilename }}</span>
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

<style scoped>
.workflow-preview-content {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-xl);
  max-width: var(--popover-width);
  background-color: var(--comfy-menu-bg);
  color: var(--fg-color);
}

.workflow-preview-thumbnail {
  position: relative;
  padding: calc(var(--spacing) * 2);
}

.workflow-preview-thumbnail img {
  box-shadow: var(--shadow-md);
  background-color: color-mix(in srgb, var(--comfy-menu-bg) 70%, black);
}

.dark-theme .workflow-preview-thumbnail img {
  box-shadow: var(--shadow-lg);
}

.workflow-preview-footer {
  padding-top: calc(var(--spacing) * 1);
  padding-right: calc(var(--spacing) * 3);
  padding-bottom: calc(var(--spacing) * 2);
  padding-left: calc(var(--spacing) * 3);
}

.workflow-preview-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
  font-weight: var(--font-weight-medium);
  color: var(--fg-color);
}
</style>

<style>
.workflow-popover-fade {
  border-radius: var(--radius-xl);
  background-color: transparent;
  box-shadow: var(--shadow-lg);
  transition: opacity 0.15s ease-out;
}

.dark-theme .workflow-popover-fade {
  box-shadow: var(--shadow-2xl);
}
</style>
