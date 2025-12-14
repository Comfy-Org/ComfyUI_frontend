<template>
  <div class="flex h-full items-center">
    <div
      v-if="isDragging && !docked"
      :class="actionbarClass"
      @mouseenter="onMouseEnterDropZone"
      @mouseleave="onMouseLeaveDropZone"
    >
      {{ t('actionbar.dockToTop') }}
    </div>

    <div
      ref="actionbarWrapperRef"
      :class="panelClass"
      :style="style"
      class="flex flex-col items-stretch"
    >
      <Panel
        :class="
          cn(
            panelRootClass,
            isDragging ? 'pointer-events-none' : 'pointer-events-auto'
          )
        "
        :pt="{
          header: { class: 'hidden' },
          content: { class: 'p-0' }
        }"
      >
        <div
          ref="panelRef"
          :class="cn('flex flex-col', docked ? 'p-0' : 'p-1')"
        >
          <div class="flex items-center select-none">
            <span
              ref="dragHandleRef"
              :class="
                cn(
                  'drag-handle cursor-grab w-3 h-max mr-2',
                  isDragging && 'cursor-grabbing'
                )
              "
            />

            <Suspense @resolve="comfyRunButtonResolved">
              <ComfyRunButton />
            </Suspense>
            <IconButton
              v-tooltip.bottom="cancelJobTooltipConfig"
              type="transparent"
              size="sm"
              class="ml-2 bg-destructive-background text-base-foreground transition-colors duration-200 ease-in-out hover:bg-destructive-background-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive-background"
              :disabled="isExecutionIdle"
              :aria-label="t('menu.interrupt')"
              @click="cancelCurrentJob"
            >
              <i class="icon-[lucide--x] size-4" />
            </IconButton>
            <IconTextButton
              v-tooltip.bottom="queueHistoryTooltipConfig"
              size="sm"
              type="secondary"
              icon-position="right"
              data-testid="queue-toggle-button"
              class="ml-2 h-8 border-0 px-3 text-sm font-medium text-base-foreground cursor-pointer"
              :aria-pressed="props.queueOverlayExpanded"
              :aria-label="queueToggleLabel"
              :label="queueToggleLabel"
              @click="toggleQueueOverlay"
            >
              <!-- Custom implementation for static 1-2 digit shifts -->
              <span class="flex items-center gap-1">
                <span
                  class="inline-flex min-w-[2ch] justify-center tabular-nums text-center"
                >
                  {{ queuedCount }}
                </span>
                <span>{{ queuedSuffix }}</span>
              </span>
              <template #icon>
                <i class="icon-[lucide--chevron-down] size-4" />
              </template>
            </IconTextButton>
          </div>
        </div>
      </Panel>
      <div v-if="isFloating" class="flex justify-end pt-1 pr-1">
        <QueueInlineProgressSummary
          class="pr-1"
          :hidden="props.queueOverlayExpanded"
        />
      </div>
    </div>

    <Teleport v-if="inlineProgressTarget" :to="inlineProgressTarget">
      <QueueInlineProgress
        :hidden="props.queueOverlayExpanded"
        data-testid="queue-inline-progress"
      />
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
import {
  unrefElement,
  useDraggable,
  useEventListener,
  useLocalStorage,
  watchDebounced
} from '@vueuse/core'
import { clamp } from 'es-toolkit/compat'
import { storeToRefs } from 'pinia'
import Panel from 'primevue/panel'
import { computed, nextTick, ref, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import QueueInlineProgress from '@/components/queue/QueueInlineProgress.vue'
import QueueInlineProgressSummary from '@/components/queue/QueueInlineProgressSummary.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import { t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

import ComfyRunButton from './ComfyRunButton'

const props = defineProps<{
  queueOverlayExpanded: boolean
  topMenuContainer?: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'update:queueOverlayExpanded', value: boolean): void
}>()

const settingsStore = useSettingStore()
const executionStore = useExecutionStore()
const commandStore = useCommandStore()
const queueStore = useQueueStore()

const position = computed(() => settingsStore.get('Comfy.UseNewMenu'))
const visible = computed(() => position.value !== 'Disabled')

const tabContainer = document.querySelector('.workflow-tabs-container')
const actionbarWrapperRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
const docked = defineModel<boolean>('docked', { default: false })
const storedPosition = useLocalStorage('Comfy.MenuPosition.Floating', {
  x: 0,
  y: 0
})
const wrapperElement = computed(() => {
  const element = unrefElement(actionbarWrapperRef)
  return element instanceof HTMLElement ? element : null
})
const panelElement = computed(() => {
  const element = unrefElement(panelRef)
  return element instanceof HTMLElement ? element : null
})
const { x, y, style, isDragging } = useDraggable(wrapperElement, {
  initialValue: { x: 0, y: 0 },
  handle: dragHandleRef,
  containerElement: document.body,
  onMove: (event) => {
    // Prevent dragging the menu over the top of the tabs
    const minY = tabContainer?.getBoundingClientRect().bottom ?? 40
    if (event.y < minY) {
      event.y = minY
    }
  }
})

// Queue and Execution logic
const { isIdle: isExecutionIdle } = storeToRefs(executionStore)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const queueToggleLabel = computed(() =>
  t('sideToolbar.queueProgressOverlay.toggleLabel', {
    count: queuedCount.value
  })
)
const queuedSuffix = computed(() =>
  t('sideToolbar.queueProgressOverlay.queuedSuffix')
)
const queueHistoryTooltipConfig = computed(() =>
  buildTooltipConfig(t('sideToolbar.queueProgressOverlay.viewJobHistory'))
)
const cancelJobTooltipConfig = computed(() =>
  buildTooltipConfig(t('menu.interrupt'))
)

const toggleQueueOverlay = () => {
  emit('update:queueOverlayExpanded', !props.queueOverlayExpanded)
}

const cancelCurrentJob = async () => {
  if (isExecutionIdle.value) return
  await commandStore.execute('Comfy.Interrupt')
}

// Update storedPosition when x or y changes
watchDebounced(
  [x, y],
  ([newX, newY]) => {
    storedPosition.value = { x: newX, y: newY }
  },
  { debounce: 300 }
)

// Set initial position to bottom center
const setInitialPosition = () => {
  const containerEl = wrapperElement.value
  if (containerEl) {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const menuWidth = containerEl.offsetWidth
    const menuHeight = containerEl.offsetHeight

    if (menuWidth === 0 || menuHeight === 0) {
      return
    }

    // Check if stored position exists and is within bounds
    if (storedPosition.value.x !== 0 || storedPosition.value.y !== 0) {
      // Ensure stored position is within screen bounds
      x.value = clamp(storedPosition.value.x, 0, screenWidth - menuWidth)
      y.value = clamp(storedPosition.value.y, 0, screenHeight - menuHeight)
      captureLastDragState()
      return
    }

    // If no stored position or current position, set to bottom center
    if (x.value === 0 && y.value === 0) {
      x.value = clamp((screenWidth - menuWidth) / 2, 0, screenWidth - menuWidth)
      y.value = clamp(
        screenHeight - menuHeight - 10,
        0,
        screenHeight - menuHeight
      )
      captureLastDragState()
    }
  }
}

//The ComfyRunButton is a dynamic import. Which means it will not be loaded onMount in this component.
//So we must use suspense resolve to ensure that is has loaded and updated the DOM before calling setInitialPosition()
async function comfyRunButtonResolved() {
  await nextTick()
  setInitialPosition()
}

watch(visible, async (newVisible) => {
  if (newVisible) {
    await nextTick(setInitialPosition)
  }
})

/**
 * Track run button handle drag start using mousedown on the drag handle.
 */
useEventListener(dragHandleRef, 'mousedown', () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'actionbar_run_handle_drag_start'
  })
})

const lastDragState = ref({
  x: x.value,
  y: y.value,
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight
})
const captureLastDragState = () => {
  lastDragState.value = {
    x: x.value,
    y: y.value,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight
  }
}
watch(
  isDragging,
  (newIsDragging) => {
    if (!newIsDragging) {
      // Stop dragging
      captureLastDragState()
    }
  },
  { immediate: true }
)

const adjustMenuPosition = () => {
  const containerEl = wrapperElement.value
  if (containerEl) {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    const menuWidth = containerEl.offsetWidth
    const menuHeight = containerEl.offsetHeight

    // Calculate distances to all edges
    const distanceLeft = lastDragState.value.x
    const distanceRight =
      lastDragState.value.windowWidth - (lastDragState.value.x + menuWidth)
    const distanceTop = lastDragState.value.y
    const distanceBottom =
      lastDragState.value.windowHeight - (lastDragState.value.y + menuHeight)

    // Find the smallest distance to determine which edge to anchor to
    const distances = [
      { edge: 'left', distance: distanceLeft },
      { edge: 'right', distance: distanceRight },
      { edge: 'top', distance: distanceTop },
      { edge: 'bottom', distance: distanceBottom }
    ]
    const closestEdge = distances.reduce((min, curr) =>
      curr.distance < min.distance ? curr : min
    )

    // Calculate vertical position as a percentage of screen height
    const verticalRatio =
      lastDragState.value.y / lastDragState.value.windowHeight
    const horizontalRatio =
      lastDragState.value.x / lastDragState.value.windowWidth

    // Apply positioning based on closest edge
    if (closestEdge.edge === 'left') {
      x.value = closestEdge.distance // Maintain exact distance from left
      y.value = verticalRatio * screenHeight
    } else if (closestEdge.edge === 'right') {
      x.value = screenWidth - menuWidth - closestEdge.distance // Maintain exact distance from right
      y.value = verticalRatio * screenHeight
    } else if (closestEdge.edge === 'top') {
      x.value = horizontalRatio * screenWidth
      y.value = closestEdge.distance // Maintain exact distance from top
    } else {
      // bottom
      x.value = horizontalRatio * screenWidth
      y.value = screenHeight - menuHeight - closestEdge.distance // Maintain exact distance from bottom
    }

    // Ensure the menu stays within the screen bounds
    x.value = clamp(x.value, 0, screenWidth - menuWidth)
    y.value = clamp(y.value, 0, screenHeight - menuHeight)
  }
}

useEventListener(window, 'resize', adjustMenuPosition)

// Drop zone state
const isMouseOverDropZone = ref(false)

// Mouse event handlers for self-contained drop zone
const onMouseEnterDropZone = () => {
  if (isDragging.value) {
    isMouseOverDropZone.value = true
  }
}

const onMouseLeaveDropZone = () => {
  if (isDragging.value) {
    isMouseOverDropZone.value = false
  }
}

// Handle drag state changes
watch(isDragging, (dragging) => {
  if (dragging) {
    // Starting to drag - undock if docked
    if (docked.value) {
      docked.value = false
    }
  } else {
    // Stopped dragging - dock if mouse is over drop zone
    if (isMouseOverDropZone.value) {
      docked.value = true
    }
    // Reset drop zone state
    isMouseOverDropZone.value = false
  }
})
const isFloating = computed(() => visible.value && !docked.value)
const inlineProgressTarget = computed(() => {
  if (!visible.value) return null
  if (isFloating.value) return panelElement.value
  return props.topMenuContainer ?? null
})
const actionbarClass = computed(() =>
  cn(
    'w-[300px] border-dashed border-blue-500 opacity-80',
    'm-1.5 flex items-center justify-center self-stretch',
    'rounded-md before:w-50 before:-ml-50 before:h-full',
    'pointer-events-auto',
    isMouseOverDropZone.value &&
      'border-[3px] opacity-100 scale-105 shadow-[0_0_20px] shadow-blue-500'
  )
)
const panelClass = computed(() =>
  cn(
    'actionbar z-1300 overflow-hidden rounded-[var(--p-panel-border-radius)]',
    docked.value ? 'p-0 static mr-2 border-none bg-transparent' : 'fixed',
    isDragging.value ? 'select-none pointer-events-none' : 'pointer-events-auto'
  )
)
const panelRootClass = computed(() =>
  cn(
    'relative overflow-hidden rounded-[var(--p-panel-border-radius)]',
    docked.value
      ? 'border-none shadow-none bg-transparent'
      : 'border border-interface-stroke shadow-interface'
  )
)

defineExpose({
  isFloating
})
</script>
