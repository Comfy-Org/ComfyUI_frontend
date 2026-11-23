<template>
  <div
    ref="grid"
    data-testid="node-widgets"
    class="lg-node-widgets contents text-xs text-node-foreground"
    :data-expands="expands"
  >
    <div
      v-for="(section, sectionIndex) in sections"
      :key="section.key"
      :role="section.role"
      :aria-label="section.label"
      class="contents"
    >
      <template
        v-for="(row, rowIndex) in section.rows"
        :key="row.widget.renderKey"
      >
        <div
          :data-testid="row.testId"
          :data-widget-name="row.widget.simplified.name"
          :data-autogrow-group="row.autogrowGroup"
          :style="row.style"
          :class="
            cn(
              'group relative mr-3 grid grid-cols-[min-content_minmax(0,1fr)] items-stretch triangle-icons:mr-3.75',
              row.flexClass,
              rowSpacingClass(row.showsControl),
              rowEdgeClass(sectionIndex, rowIndex),
              row.highlightClass
            )
          "
        >
          <div class="z-10 flex items-stretch" :class="row.slotClass">
            <InputSlot
              v-if="row.widget.slotMetadata"
              :key="`widget-slot-${row.widget.simplified.name}-${row.widget.slotMetadata.index}`"
              :slot-data="{
                name: row.widget.simplified.name,
                label: row.widget.simplified.label,
                type: row.widget.slotMetadata.type,
                shape: row.widget.slotMetadata.shape,
                boundingRect: [0, 0, 0, 0]
              }"
              :node-id
              :has-error="row.widget.hasError"
              :index="row.widget.slotMetadata.index"
              :connected="row.widget.slotMetadata.linked"
              :compatible="row.inHoveredGroup"
              :socketless="row.widget.simplified.spec?.socketless"
              :standalone="row.standalone"
              :dot-only="row.showsControl"
              :linked-widget="row.linkedWidget"
            />
          </div>
          <AppInput
            v-if="row.showsControl"
            :widget-id="row.widget.widgetId"
            :name="row.widget.simplified.name"
            :enable="row.selectable"
          >
            <Tooltip :disabled="!row.widget.tooltipText">
              <TooltipTrigger as-child>
                <div :class="row.controlClass">
                  <component
                    :is="row.widget.vueComponent"
                    :model-value="row.widget.simplified.value"
                    :widget="row.widget.simplified"
                    :node-id
                    :node-type
                    :node-title
                    :invalid="row.widget.hasError"
                    :aria-invalid="row.widget.hasError || undefined"
                    :class="
                      cn('col-span-full', row.widget.hasError && 'font-bold')
                    "
                    @update:model-value="row.widget.updateHandler"
                    @contextmenu="row.widget.handleContextMenu"
                    @removed="restoreRowFocus"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">{{
                row.widget.tooltipText
              }}</TooltipContent>
            </Tooltip>
          </AppInput>
          <GrowableRegionHandle
            v-if="row.growable"
            :name="row.widget.simplified.name"
            :label="
              $t(
                'g.resizeWidgetHeight',
                {
                  name:
                    row.widget.simplified.label || row.widget.simplified.name
                },
                { escapeParameter: false }
              )
            "
            :max-height="row.maxHeight"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import { useResizeObserver } from '@vueuse/core'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { minRowHeight } from '@/lib/litegraph/src/utils/widgetLayout'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  autogrowIoInputDragType,
  hoveredAutogrowGroup
} from '@/renderer/core/canvas/links/autogrowGroupDropState'
import { syncSlotOffsets } from '@/renderer/core/layout/slots/syncSlotOffsets'
import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import { useWidgetGridResizeTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import {
  growableRegionsKey,
  userHeightTrack
} from '@/renderer/extensions/vueNodes/layout/useGrowableRegions'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { cn } from '@comfyorg/tailwind-utils'

import GrowableRegionHandle from './GrowableRegionHandle.vue'
import InputSlot from './InputSlot.vue'

const grid = useTemplateRef<HTMLElement>('grid')

const isConvertedWidgetType = (type: string) =>
  type === 'converted-widget' || type.startsWith('converted-widget:')

const growableRegions = inject(growableRegionsKey, undefined)

function rowSpacingClass(showsControl: boolean) {
  return showsControl
    ? 'lg-node-widget my-[calc((var(--node-widget-gap)-var(--spacing))/2)]'
    : '-my-0.5 triangle-icons:my-0'
}

function rowEdgeClass(sectionIndex: number, rowIndex: number) {
  const lastSection = sections.value.length - 1
  return cn(
    sectionIndex === 0 && rowIndex === 0 && 'mt-0',
    sectionIndex === lastSection &&
      rowIndex === sections.value[lastSection].rows.length - 1 &&
      'mb-0'
  )
}

function rowSizing(
  name: string,
  growable: boolean,
  sizing: WidgetGridItem['sizing']
) {
  const minHeight = sizing ? `${minRowHeight(sizing)}px` : undefined
  if (!growable)
    return {
      growable,
      flexClass: 'flex-none',
      style: { minHeight },
      controlClass: 'grid min-w-0 grid-cols-1 self-center'
    }
  const maxHeight = sizing?.kind === 'growable' ? sizing.maxHeight : undefined
  const userHeight = growableRegions?.heightOf(name)
  const fills = userHeight === undefined
  return {
    growable,
    maxHeight,
    flexClass: fills ? 'grow shrink-0' : 'flex-none',
    style: fills
      ? {
          minHeight,
          maxHeight: maxHeight === undefined ? undefined : `${maxHeight}px`
        }
      : { minHeight, gridTemplateRows: userHeightTrack(userHeight) },
    controlClass: 'grid min-w-0 grid-cols-1'
  }
}

const {
  processedWidgets,
  nodeType,
  canSelectInputs = false,
  nodeId,
  nodeTitle,
  syncLayout = true
} = defineProps<{
  processedWidgets: WidgetGridItem[]
  nodeType: string
  canSelectInputs?: boolean
  nodeId?: NodeId
  nodeTitle?: string
  syncLayout?: boolean
}>()

useWidgetGridResizeTracking(syncLayout ? String(nodeId ?? '') : '')
const canvasStore = useCanvasStore()
const hoveredGroupName = computed(() => {
  const hovered = hoveredAutogrowGroup.value
  return hovered && hovered.nodeId === nodeId ? hovered.groupName : undefined
})

function revealedAutogrowGroup(widget: WidgetGridItem) {
  const slot = widget.slotMetadata
  if (widget.inputRole !== 'autogrowGroup' || !slot) return undefined
  const dragType = autogrowIoInputDragType.value
  const accepts =
    dragType !== undefined && LiteGraph.isValidConnection(dragType, slot.type)
  return slot.linked || accepts ? widget.simplified.name : undefined
}

function isInHoveredGroup(name: string) {
  const group = hoveredGroupName.value
  return !!group && (name === group || name.startsWith(`${group}.`))
}

const socketRow = {
  showsControl: false,
  testId: undefined,
  slotClass: 'col-span-full'
}
const rowKinds = {
  control: {
    showsControl: true,
    standalone: false,
    testId: 'node-widget',
    slotClass:
      'h-(--node-widget-height) min-h-full w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 has-[.lg-slot--compatible,.lg-slot--connected]:opacity-100 triangle-icons:w-3.75'
  },
  socket: { ...socketRow, standalone: true },
  convertedSocket: { ...socketRow, standalone: false }
}

function rowKind(widget: WidgetGridItem, autogrowGroup?: string) {
  const { slotMetadata, suppressedByConnection } = widget
  if (isConvertedWidgetType(widget.simplified.type)) {
    if (!slotMetadata) return undefined
    return suppressedByConnection ? 'socket' : 'convertedSocket'
  }
  if (widget.visible)
    return widget.inputRole === 'socket' ? 'socket' : 'control'
  const revealed = suppressedByConnection || autogrowGroup
  return revealed && slotMetadata ? 'socket' : undefined
}

const renderedRows = computed(() => fillWithLastLegacyRow(rawRows.value))

function fillWithLastLegacyRow(rows: typeof rawRows.value) {
  const last = rows.at(-1)
  if (
    !last?.showsControl ||
    last.widget.vueComponent !== WidgetLegacy ||
    rows.some(({ growable }) => growable)
  )
    return rows
  return [
    ...rows.slice(0, -1),
    {
      ...last,
      flexClass: 'grow shrink-0',
      controlClass: 'grid min-w-0 grid-cols-1'
    }
  ]
}

const rawRows = computed(() =>
  processedWidgets.flatMap((widget) => {
    const autogrowGroup = revealedAutogrowGroup(widget)
    const kind = rowKind(widget, autogrowGroup)
    if (!kind) return []
    const { showsControl } = rowKinds[kind]
    const sizing = showsControl ? widget.sizing : undefined
    const inHoveredGroup = isInHoveredGroup(widget.simplified.name)
    return [
      {
        ...rowKinds[kind],
        widget,
        selectable: canSelectInputs && !widget.simplified.options?.disabled,
        linkedWidget: !showsControl && !!widget.suppressedByConnection,
        ...rowSizing(
          widget.simplified.name,
          showsControl && shouldExpand(widget.simplified.type, sizing),
          sizing
        ),
        autogrowGroup,
        inHoveredGroup,
        highlightClass: inHoveredGroup && 'rounded-sm ring-1 ring-primary'
      }
    ]
  })
)

function withShortFieldLabel(
  widget: WidgetGridItem,
  groupName: string,
  groupLabel?: string
) {
  const field =
    widget.simplified.spec?.display_name ??
    widget.simplified.name.slice(groupName.length + 1)
  return widget.simplified.label === `${groupLabel} ${field}`
    ? {
        ...widget,
        simplified: { ...widget.simplified, displayLabel: field }
      }
    : widget
}

const sections = computed(() => {
  const result: {
    key: string
    name?: string
    label?: string
    role?: 'group'
    rows: typeof renderedRows.value
  }[] = []
  for (const row of renderedRows.value) {
    const { name, type, label } = row.widget.simplified
    if (type === 'dynamic_group_row') {
      result.push({
        key: row.widget.renderKey,
        name,
        label,
        role: label ? 'group' : undefined,
        rows: [row]
      })
      continue
    }
    const section = result.at(-1)
    if (!section?.name || !name.startsWith(`${section.name}.`)) {
      result.push({ key: row.widget.renderKey, rows: [row] })
      continue
    }
    section.rows.push({
      ...row,
      widget: withShortFieldLabel(row.widget, section.name, section.label)
    })
  }
  return result
})

async function restoreRowFocus(name: string) {
  const group = name.slice(0, name.lastIndexOf('.'))
  await nextTick()
  const remaining = sections.value.filter((section) =>
    section.name?.startsWith(`${group}.`)
  )
  const candidates = [
    name,
    ...remaining.map((section) => section.name).reverse(),
    `${group}.$add`
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const button = grid.value?.querySelector<HTMLButtonElement>(
      `[data-widget-name="${CSS.escape(candidate)}"] button:not(:disabled)`
    )
    if (button) {
      button.focus()
      return
    }
  }
}

const expands = computed(
  () => renderedRows.value.some((row) => row.growable) || undefined
)

const layoutKey = computed(() =>
  renderedRows.value
    .map(
      ({ widget, showsControl }) =>
        `${widget.renderKey}:${widget.slotMetadata?.index ?? ''}:${showsControl}`
    )
    .join('|')
)

function syncOffsets() {
  const rootGraphId = canvasStore.rootGraphId
  if (syncLayout && grid.value && rootGraphId && nodeId) {
    syncSlotOffsets(grid.value, rootGraphId, nodeId)
  }
}

const rows = shallowRef<HTMLElement[]>([])
useResizeObserver(rows, syncOffsets)

function trackRows() {
  rows.value =
    syncLayout && nodeId && grid.value
      ? [...grid.value.querySelectorAll<HTMLElement>('[data-widget-name]')]
      : []
}

onMounted(trackRows)
watch(
  layoutKey,
  () => {
    trackRows()
    syncOffsets()
  },
  { flush: 'post' }
)
</script>
