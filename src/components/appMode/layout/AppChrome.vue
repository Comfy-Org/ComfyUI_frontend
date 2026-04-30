<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import BatchCountCell from './cells/BatchCountCell.vue'
import FeedbackCell from './cells/FeedbackCell.vue'
import IconCell from './cells/IconCell.vue'
import JobQueueCell from './cells/JobQueueCell.vue'
import ModeToggleCell from './cells/ModeToggleCell.vue'
import RunCell from './cells/RunCell.vue'

import { useAppMode } from '@/composables/useAppMode'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import {
  openShareDialog,
  prefetchShareDialog
} from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore } from '@/stores/queueStore'

type ChromeCellKind =
  | 'system-mode-toggle'
  | 'system-builder'
  | 'system-share'
  | 'system-feedback'
  | 'system-batch-count'
  | 'system-job-queue'
  | 'system-run'
  | 'nav-zoom-in'
  | 'nav-zoom-out'
  | 'nav-zoom-percent'
  | 'nav-zoom-fit'
  | 'nav-no-zoom'

interface ChromeCell {
  id: string
  kind: ChromeCellKind
  /** Width = span × cell + (span - 1) × gutter. */
  span: number
  disabled?: boolean
}

type AppChromeVariant = 'app-mode' | 'builder'

const { variant = 'app-mode' } = defineProps<{
  variant?: AppChromeVariant
}>()

const { t } = useI18n()
const { enableAppBuilder, isArrangeMode } = useAppMode()
const appModeStore = useAppModeStore()
const { enterBuilder, zoomIn, zoomOut, resetView, toggleNoZoomMode } =
  appModeStore
const { hasNodes, viewportScale, noZoomMode } = storeToRefs(appModeStore)

const canvasStore = useCanvasStore()
const { appScalePercentage } = storeToRefs(canvasStore)
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()

// GraphCanvasMenu registers initScaleSync() for graph view; builder
// doesn't mount that menu so we register from here.
if (variant === 'builder') {
  onMounted(() => canvasStore.initScaleSync())
  onBeforeUnmount(() => canvasStore.cleanupScaleSync())
}

// One nav cluster, two zoom systems: appModeStore (CSS transform) for
// app/arrange; LGraphCanvas.ds.scale for builder/inputs+outputs.
const useAppModeZoom = computed(
  () => variant !== 'builder' || isArrangeMode.value
)

const zoomPercent = computed(() =>
  useAppModeZoom.value
    ? `${Math.round(viewportScale.value * 100)}%`
    : `${appScalePercentage.value}%`
)

function dispatchCanvas(commandId: string) {
  commandStore.execute(commandId).catch(toastErrorHandler)
}

const navZoomIn = () => {
  if (useAppModeZoom.value) return zoomIn()
  dispatchCanvas('Comfy.Canvas.ZoomIn')
}
const navZoomOut = () => {
  if (useAppModeZoom.value) return zoomOut()
  dispatchCanvas('Comfy.Canvas.ZoomOut')
}
const navResetView = () => {
  if (useAppModeZoom.value) return resetView()
  dispatchCanvas('Comfy.Canvas.FitView')
}
const { flags } = useFeatureFlags()

const showShare = computed(() => isCloud && flags.workflowSharingEnabled)

const queueStore = useQueueStore()
const { activeJobsCount } = storeToRefs(queueStore)
const showJobQueue = computed(() => activeJobsCount.value > 0)

function openShare() {
  openShareDialog().catch(toastErrorHandler)
}

const HIDE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-mode-toggle',
  'system-builder'
])

const DISABLE_IN_BUILDER = new Set<ChromeCellKind>([
  'system-batch-count',
  'system-run'
])

function include(out: ChromeCell[], cell: ChromeCell) {
  if (variant === 'builder' && HIDE_IN_BUILDER.has(cell.kind)) return
  if (variant === 'builder' && DISABLE_IN_BUILDER.has(cell.kind)) {
    out.push({ ...cell, disabled: true })
    return
  }
  out.push(cell)
}

const topLeftCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'mode-toggle', kind: 'system-mode-toggle', span: 2 })
  if (enableAppBuilder.value) {
    include(out, { id: 'builder', kind: 'system-builder', span: 1 })
  }
  return out
})

const topRightCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  // Conditional cells go leftmost so show/hide doesn't shift the rest.
  if (showJobQueue.value)
    include(out, { id: 'system-job-queue', kind: 'system-job-queue', span: 2 })
  if (showShare.value)
    include(out, { id: 'share', kind: 'system-share', span: 2 })
  include(out, {
    id: 'system-batch-count',
    kind: 'system-batch-count',
    span: 5
  })
  include(out, { id: 'system-run', kind: 'system-run', span: 2 })
  return out
})

const bottomLeftCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  include(out, { id: 'feedback', kind: 'system-feedback', span: 4 })
  return out
})

const bottomRightCells = computed<ChromeCell[]>(() => {
  const out: ChromeCell[] = []
  if (variant !== 'builder') {
    include(out, { id: 'nav-no-zoom', kind: 'nav-no-zoom', span: 1 })
  }
  include(out, { id: 'nav-zoom-out', kind: 'nav-zoom-out', span: 1 })
  include(out, { id: 'nav-zoom-percent', kind: 'nav-zoom-percent', span: 2 })
  include(out, { id: 'nav-zoom-in', kind: 'nav-zoom-in', span: 1 })
  include(out, { id: 'nav-zoom-fit', kind: 'nav-zoom-fit', span: 1 })
  return out
})

function cellWidth(span: number): string {
  return `calc(${span} * var(--spacing-layout-cell) + ${span - 1} * var(--spacing-layout-gutter))`
}

function cellTitle(cell: ChromeCell): string | undefined {
  if (cell.disabled) return t('linearMode.builder.runDisabledHint')
  return undefined
}

const ZONE_BASE =
  'pointer-events-none absolute flex h-layout-cell flex-row gap-layout-gutter'

function cellClass(cell: ChromeCell): string {
  // `system-run` skips border+fill so its colored button reaches the edges.
  const bare = cell.kind === 'system-run'
  return cn(
    'pointer-events-auto flex h-full overflow-hidden',
    !bare && 'rounded-[10px] border border-white/8 bg-layout-cell',
    cell.disabled && 'cursor-not-allowed select-none'
  )
}
</script>

<template>
  <!-- `app-mode` anchors absolute-inset inside LayoutView;
       `builder` is fixed to the viewport below the workflow tabs. -->
  <div
    :class="
      cn(
        'app-chrome pointer-events-none absolute inset-0 z-1',
        variant === 'builder' && [
          'fixed top-(--workflow-tabs-height) right-0 bottom-0',
          'left-(--sidebar-width,0px) z-90 cursor-not-allowed'
        ]
      )
    "
    :data-variant="variant"
  >
    <div
      :class="[
        ZONE_BASE,
        'top-(--spacing-layout-outer) left-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in topLeftCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'system-builder'"
          icon="icon-[lucide--hammer]"
          :label="t('linearMode.appModeToolbar.appBuilder')"
          :disabled="!hasNodes"
          @activate="enterBuilder"
        />
        <ModeToggleCell v-else-if="cell.kind === 'system-mode-toggle'" />
      </div>
    </div>

    <div
      :class="[
        ZONE_BASE,
        'top-(--spacing-layout-outer) right-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in topRightCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'system-share'"
          icon="icon-[lucide--send]"
          :label="t('actionbar.share')"
          inline-label
          @activate="openShare"
          @pointerenter="prefetchShareDialog"
        />
        <BatchCountCell v-else-if="cell.kind === 'system-batch-count'" />
        <JobQueueCell v-else-if="cell.kind === 'system-job-queue'" />
        <RunCell v-else-if="cell.kind === 'system-run'" />
      </div>
    </div>

    <div
      :class="[
        ZONE_BASE,
        'bottom-(--spacing-layout-outer) left-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in bottomLeftCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <FeedbackCell v-if="cell.kind === 'system-feedback'" />
      </div>
    </div>

    <div
      :class="[
        ZONE_BASE,
        'right-(--spacing-layout-outer) bottom-(--spacing-layout-outer)'
      ]"
    >
      <div
        v-for="cell in bottomRightCells"
        :key="cell.id"
        :class="cellClass(cell)"
        :inert="cell.disabled || undefined"
        :title="cellTitle(cell)"
        :style="{ width: cellWidth(cell.span) }"
        :data-cell-kind="cell.kind"
      >
        <IconCell
          v-if="cell.kind === 'nav-no-zoom'"
          :icon="
            noZoomMode
              ? 'icon-[lucide--layout-grid]'
              : 'icon-[lucide--maximize-2]'
          "
          :active="noZoomMode"
          :label="t('linearMode.toggleNoZoom')"
          @activate="toggleNoZoomMode"
        />
        <IconCell
          v-else-if="cell.kind === 'nav-zoom-out'"
          icon="icon-[lucide--zoom-out]"
          :label="t('linearMode.zoomOut')"
          @activate="navZoomOut"
        />
        <div
          v-else-if="cell.kind === 'nav-zoom-percent'"
          :class="[
            'flex size-full items-center justify-center',
            'font-inter text-layout-md text-layout-text tabular-nums',
            'cursor-default select-none'
          ]"
        >
          {{ zoomPercent }}
        </div>
        <IconCell
          v-else-if="cell.kind === 'nav-zoom-in'"
          icon="icon-[lucide--zoom-in]"
          :label="t('linearMode.zoomIn')"
          @activate="navZoomIn"
        />
        <IconCell
          v-else-if="cell.kind === 'nav-zoom-fit'"
          icon="icon-[lucide--maximize]"
          :label="t('linearMode.resetView')"
          @activate="navResetView"
        />
      </div>
    </div>
  </div>
</template>
