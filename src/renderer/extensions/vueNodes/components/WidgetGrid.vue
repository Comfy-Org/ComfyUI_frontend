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
          :data-part="row.part"
          :data-widget-type="row.widget.simplified.type"
          :data-linked="row.linked"
          :data-content-key="row.rowContentKey"
          :style="row.style"
          :class="
            cn(
              'group relative mr-3 grid grid-cols-[min-content_minmax(0,1fr)] items-stretch',
              row.flexClass,
              rowSpacingClass(row.showsControl),
              rowEdgeClass(sectionIndex, rowIndex),
              row.highlightClass
            )
          "
        >
          <div
            class="z-10 flex items-stretch"
            :class="row.slotClass"
            data-part="row-slot"
          >
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
            :enable="row.selectable"
          >
            <div
              :data-node-tooltip="row.widget.tooltipText"
              data-node-tooltip-side="top"
              :data-content-key="row.controlContentKey"
              :class="row.controlClass"
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
                :class="cn('col-span-full', row.widget.hasError && 'font-bold')"
                @update:model-value="row.widget.updateHandler"
                @contextmenu="row.widget.handleContextMenu"
                @removed="restoreRowFocus"
              />
            </div>
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
            :min-height="row.floorHeight"
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
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import { useResizeObserver } from '@vueuse/core'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { minRowHeight } from '@/lib/litegraph/src/utils/widgetLayout'
import {
  autogrowIoInputDragType,
  hoveredAutogrowGroup
} from '@/renderer/core/canvas/links/autogrowGroupDropState'
import AppInput from '@/renderer/extensions/linearMode/AppInput.vue'
import {
  growableRegionsKey,
  userHeightTrack
} from '@/renderer/extensions/vueNodes/layout/useGrowableRegions'
import type { BodyItem } from '@/renderer/extensions/vueNodes/layout/vueNodeBodyLayout'
import { vueNodeBodyKey } from '@/renderer/extensions/vueNodes/layout/vueNodeBodyLayoutRegistry'
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
    : '-my-0.5'
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
      sizing,
      userHeight: undefined,
      flexClass: 'flex-none',
      style: { minHeight },
      controlClass: 'grid min-w-0 grid-cols-1 self-center'
    }
  const maxHeight = sizing?.kind === 'growable' ? sizing.maxHeight : undefined
  const userHeight = growableRegions?.heightOf(name)
  const fills = userHeight === undefined
  return {
    growable,
    sizing,
    userHeight,
    floorHeight: sizing && minRowHeight(sizing),
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

const body =
  syncLayout && nodeId ? inject(vueNodeBodyKey, undefined) : undefined
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
  part: 'socket-row',
  testId: undefined,
  slotClass: 'col-span-full'
}
const rowKinds = {
  control: {
    showsControl: true,
    part: 'widget-row',
    standalone: false,
    testId: 'node-widget',
    slotClass:
      'h-(--node-widget-height) min-h-full w-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 has-[.lg-slot--compatible,.lg-slot--connected]:opacity-100'
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

type RawRow = (typeof rawRows.value)[number]

function fillsSpace(row: RawRow) {
  return row.flexClass.startsWith('grow')
}

function bodyItem(row: RawRow): BodyItem {
  const key = row.widget.renderKey
  const input = row.widget.slotMetadata?.index
  if (!row.showsControl) return { kind: 'socket', key, input }
  return {
    kind: 'control',
    key,
    input,
    growable: fillsSpace(row),
    sizing: row.sizing,
    userHeight: row.userHeight
  }
}

function measureOf(row: RawRow) {
  if (!row.showsControl || row.userHeight !== undefined) return undefined
  if (fillsSpace(row)) return row.sizing ? undefined : 'row'
  return row.sizing?.kind === 'fixed' ? undefined : 'control'
}

function contentKeys(key: string, measure: ReturnType<typeof measureOf>) {
  return {
    key,
    measure,
    rowContentKey: measure === 'row' ? key : undefined,
    controlContentKey: measure === 'control' ? key : undefined
  }
}

function placed(row: RawRow) {
  const keys = contentKeys(row.widget.renderKey, measureOf(row))
  const { key, measure } = keys
  const slot = body?.rowOf(key)
  if (!slot || measure === 'row') return { ...row, ...keys }
  const height = `${slot.height}px`
  return {
    ...row,
    ...keys,
    flexClass: 'flex-none',
    style:
      measure === 'control'
        ? { minHeight: height }
        : { height, gridTemplateRows: 'minmax(0, 1fr)' },
    controlClass:
      row.growable || row.widget.vueComponent === WidgetLegacy
        ? 'grid min-w-0 grid-cols-1'
        : 'grid min-w-0 grid-cols-1 self-center'
  }
}

const renderedRows = computed(() =>
  fillWithLastLegacyRow(rawRows.value).map(placed)
)

function widgetItems() {
  return fillWithLastLegacyRow(rawRows.value).map(bodyItem)
}
if (body) body.widgetItems.value = widgetItems
onBeforeUnmount(() => {
  if (body?.widgetItems.value === widgetItems)
    body.widgetItems.value = undefined
})

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
        linked: !showsControl && widget.suppressedByConnection ? '' : undefined,
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
  renderedRows.value.map(({ key, measure }) => `${key}:${measure}`).join('|')
)

const measured = shallowRef<HTMLElement[]>([])
useResizeObserver(measured, (entries) => {
  for (const entry of entries) {
    const key =
      entry.target instanceof HTMLElement && entry.target.isConnected
        ? entry.target.dataset.contentKey
        : undefined
    if (key) body?.reportContentHeight(key, entry.borderBoxSize[0].blockSize)
  }
})

function trackMeasured() {
  measured.value =
    body && grid.value
      ? [...grid.value.querySelectorAll<HTMLElement>('[data-content-key]')]
      : []
}

onMounted(trackMeasured)
watch(layoutKey, trackMeasured, { flush: 'post' })
</script>
