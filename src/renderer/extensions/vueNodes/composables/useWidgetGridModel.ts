import { computed, nextTick, onMounted, shallowRef, toRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { syncSlotOffsets } from '@/renderer/core/layout/slots/syncSlotOffsets'
import { useVueElementTracking } from '@/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { cn } from '@comfyorg/tailwind-utils'
import type { Ref } from 'vue'
export interface WidgetGridProps {
  processedWidgets: WidgetGridItem[]
  nodeType: string
  canSelectInputs?: boolean
  nodeId?: NodeId
  nodeTitle?: string
  syncLayout?: boolean
  presentation?: 'node' | 'form'
}
export function useWidgetGridModel(
  source: () => WidgetGridProps,
  grid: Readonly<Ref<HTMLElement | null>>
) {
  const options = toRef(source)
  const nodePresentation = computed(() => options.value.presentation !== 'form')
  const canSelectInputs = computed(
    () => nodePresentation.value && !!options.value.canSelectInputs
  )
  const isConvertedWidgetType = (type: string) =>
    type === 'converted-widget' || type.startsWith('converted-widget:')

  useVueElementTracking(
    options.value.syncLayout !== false && nodePresentation.value
      ? String(options.value.nodeId ?? '')
      : '',
    'widgets-grid'
  )

  const canvasStore = useCanvasStore()
  const { isEditingBlocked } = storeToRefs(canvasStore)

  function captureWidgetChanges() {
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  }

  function handleContextMenu(event: PointerEvent, widget: WidgetGridItem) {
    if (!nodePresentation.value) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    widget.handleContextMenu?.(event)
  }

  function rowKind(
    widget: WidgetGridItem
  ): 'expanded' | 'compact' | 'socket' | 'hidden' {
    const hasSocket = nodePresentation.value && !!widget.slotMetadata
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

  function controlState(widget: WidgetGridItem) {
    const { disabled = false, read_only = false } =
      widget.simplified.options ?? {}
    return {
      selectable: canSelectInputs.value && !disabled,
      readOnly: disabled || read_only
    }
  }

  const renderedRows = computed(() =>
    options.value.processedWidgets.flatMap((widget) => {
      const kind = rowKind(widget)
      if (kind === 'hidden') return []
      const showsControl = kind !== 'socket'

      return [
        {
          widget,
          slot: nodePresentation.value ? widget.slotMetadata : undefined,
          ...controlState(widget),
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

  function syncOffsets() {
    const rootGraphId = canvasStore.rootGraphId
    if (
      nodePresentation.value &&
      options.value.syncLayout !== false &&
      grid.value &&
      rootGraphId &&
      options.value.nodeId
    ) {
      syncSlotOffsets(grid.value, rootGraphId, options.value.nodeId)
    }
  }

  const rows = shallowRef<HTMLElement[]>([])
  useResizeObserver(rows, syncOffsets)

  function trackRows() {
    rows.value =
      nodePresentation.value &&
      options.value.syncLayout !== false &&
      options.value.nodeId &&
      grid.value
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
  return {
    sections,
    gridStyle,
    captureWidgetChanges,
    handleContextMenu,
    restoreRowFocus,
    isEditingBlocked
  }
}
