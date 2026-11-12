<template>
  <div
    ref="grid"
    data-testid="node-widgets"
    class="lg-node-widgets grid grid-cols-[min-content_minmax(0,1fr)] gap-y-(--node-widget-gap) pr-3 text-xs text-node-foreground"
    :style="gridStyle"
  >
    <div
      v-for="section in sections"
      :key="section.key"
      :role="section.role"
      :aria-label="section.label"
      class="col-span-full grid grid-cols-subgrid grid-rows-subgrid"
      :style="{ gridRow: `span ${section.rows.length}` }"
    >
      <template v-for="row in section.rows" :key="row.widget.renderKey">
        <div
          :data-testid="row.testId"
          :data-widget-name="row.widget.simplified.name"
          :data-autogrow-group="row.autogrowGroup"
          :class="
            cn(
              'group col-span-full grid grid-cols-subgrid items-stretch',
              row.showsControl && 'lg-node-widget',
              row.socketOnly && '-mb-(--node-widget-gap)',
              row.inHoveredGroup && 'rounded-sm ring-1 ring-primary'
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
            />
          </div>
          <AppInput
            v-if="row.showsControl"
            :widget-id="row.widget.widgetId"
            :name="row.widget.simplified.name"
            :enable="
              canSelectInputs && !row.widget.simplified.options?.disabled
            "
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
              <TooltipContent side="left">{{
                row.widget.tooltipText
              }}</TooltipContent>
            </Tooltip>
          </AppInput>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
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
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  autogrowIoInputDragType,
  hoveredAutogrowGroup
} from '@/renderer/core/canvas/links/autogrowGroupDropState'
import { syncSlotOffsets } from '@/renderer/core/layout/slots/syncSlotOffsets'
import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { cn } from '@comfyorg/tailwind-utils'

import InputSlot from './InputSlot.vue'

const grid = useTemplateRef<HTMLElement>('grid')

const isConvertedWidgetType = (type: string) =>
  type === 'converted-widget' || type.startsWith('converted-widget:')

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

useVueElementTracking(syncLayout ? String(nodeId ?? '') : '', 'widgets-grid')
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
      'w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 has-[.lg-slot--compatible,.lg-slot--connected]:opacity-100'
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

const renderedRows = computed(() =>
  processedWidgets.flatMap((widget) => {
    const autogrowGroup = revealedAutogrowGroup(widget)
    const kind = rowKind(widget, autogrowGroup)
    if (!kind) return []
    const rowSize =
      rowKinds[kind].showsControl &&
      (shouldExpand(widget.simplified.type) || widget.hasLayoutSize)
        ? 'auto'
        : 'min-content'
    return [
      {
        ...rowKinds[kind],
        widget,
        rowSize,
        controlClass: cn(
          'grid min-w-0 grid-cols-1',
          rowSize === 'min-content' && 'self-center'
        ),
        autogrowGroup,
        inHoveredGroup: isInHoveredGroup(widget.simplified.name),
        socketOnly: widget.inputRole === 'socket'
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

const gridStyle = computed(() => {
  const rows = renderedRows.value.map((row) => row.rowSize).join(' ')
  return {
    'grid-template-rows': rows,
    flex: rows.includes('auto') ? 1 : undefined
  }
})

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
