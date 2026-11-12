<template>
  <div
    ref="grid"
    data-testid="node-widgets"
    :inert="canvasStore.isEditingBlocked"
    class="lg-node-widgets grid grid-cols-[min-content_minmax(0,1fr)] gap-y-(--node-widget-gap) pr-3 text-xs text-node-foreground"
    :style="gridStyle"
    @focusout="captureWidgetChanges"
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
          :class="
            cn(
              'group col-span-full grid grid-cols-subgrid items-stretch',
              row.showsControl && 'lg-node-widget'
            )
          "
        >
          <div :class="row.slotClass">
            <InputSlot
              v-if="presentation === 'node' && row.widget.slotMetadata"
              :key="`widget-slot-${row.widget.simplified.name}-${row.widget.slotMetadata.index}`"
              :slot-data="{
                name: row.widget.simplified.name,
                label: row.widget.simplified.label,
                type: row.widget.slotMetadata.type,
                boundingRect: [0, 0, 0, 0]
              }"
              :node-id
              :has-error="row.widget.hasError"
              :index="row.widget.slotMetadata.index"
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
              presentation === 'node' &&
              canSelectInputs &&
              !row.widget.simplified.options?.disabled
            "
          >
            <Tooltip :disabled="!row.widget.tooltipText">
              <TooltipTrigger as-child>
                <div
                  data-testid="widget-control-shell"
                  :inert="
                    row.widget.simplified.options?.disabled ||
                    row.widget.simplified.options?.read_only
                  "
                  :class="
                    cn(
                      'grid min-w-0 grid-cols-1',
                      row.rowSize === 'min-content' && 'self-center'
                    )
                  "
                >
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
                    @contextmenu="handleContextMenu($event, row.widget)"
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
import { computed, nextTick, useTemplateRef, watch } from 'vue'

import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
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
  syncLayout = true,
  presentation = 'node'
} = defineProps<{
  processedWidgets: WidgetGridItem[]
  nodeType: string
  canSelectInputs?: boolean
  nodeId?: NodeId
  nodeTitle?: string
  syncLayout?: boolean
  presentation?: 'node' | 'form'
}>()

useVueElementTracking(
  syncLayout && presentation === 'node' ? String(nodeId ?? '') : '',
  'widgets-grid'
)
const canvasStore = useCanvasStore()

function captureWidgetChanges() {
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
}

function handleContextMenu(event: PointerEvent, widget: WidgetGridItem) {
  if (presentation === 'form') {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  widget.handleContextMenu?.(event)
}

function rowKind(
  widget: WidgetGridItem
): 'expanded' | 'compact' | 'socket' | 'hidden' {
  const hasSocket = presentation === 'node' && !!widget.slotMetadata
  if (isConvertedWidgetType(widget.simplified.type)) {
    return hasSocket ? 'socket' : 'hidden'
  }
  if (widget.visible) {
    return shouldExpand(widget.simplified.type) || widget.hasLayoutSize
      ? 'expanded'
      : 'compact'
  }
  return widget.suppressedByConnection && hasSocket ? 'socket' : 'hidden'
}

const renderedRows = computed(() =>
  processedWidgets.flatMap((widget) => {
    const kind = rowKind(widget)
    if (kind === 'hidden') return []
    const showsControl = kind !== 'socket'

    return [
      {
        widget,
        showsControl,
        slotClass: cn(
          'z-10 flex items-stretch',
          showsControl
            ? 'w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100'
            : 'col-span-full',
          widget.slotMetadata?.linked && 'opacity-100'
        ),
        standalone: !showsControl && !!widget.suppressedByConnection,
        testId: showsControl ? 'node-widget' : undefined,
        rowSize: kind === 'expanded' ? 'auto' : 'min-content'
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

watch(
  layoutKey,
  () => {
    const rootGraphId = canvasStore.rootGraphId
    if (
      presentation === 'node' &&
      syncLayout &&
      grid.value &&
      rootGraphId &&
      nodeId
    ) {
      syncSlotOffsets(grid.value, rootGraphId, nodeId)
    }
  },
  { flush: 'post' }
)
</script>
