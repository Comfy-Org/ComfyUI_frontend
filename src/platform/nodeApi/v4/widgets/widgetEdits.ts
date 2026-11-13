import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'

import type { EditRunner } from '@/platform/nodeApi/v4/edit/editRunner'
import type { WidgetDef, WidgetValue } from '@/platform/nodeApi/v4/types'

export interface WidgetEdits {
  setInput(node: LGraphNode, widget: BaseWidget, value: WidgetValue): void
  setOption(
    node: LGraphNode,
    widget: BaseWidget,
    key: string,
    value: WidgetValue
  ): void
  setLabel(node: LGraphNode, widget: BaseWidget, label: string): void
  setHidden(node: LGraphNode, widget: BaseWidget, hidden: boolean): void
  setDisabled(node: LGraphNode, widget: BaseWidget, disabled: boolean): void
  setHeight(node: LGraphNode, widget: BaseWidget, height: number): void
  setLinked(
    node: LGraphNode,
    widget: BaseWidget,
    linked: readonly IBaseWidget[]
  ): void
  addWidget(node: LGraphNode, def: WidgetDef): void
  removeWidget(node: LGraphNode, widget: BaseWidget): void
  reorderWidgets(node: LGraphNode, ordered: readonly IBaseWidget[]): void
}

/**
 * The only place a widget is changed. Arguments are checked by the caller.
 * A change the workflow saves is one undo step of its graph; every change is redrawn.
 */
export function createWidgetEdits(runner: EditRunner): WidgetEdits {
  function saved(node: LGraphNode, edit: () => void): void {
    const { graph } = node
    if (graph) runner.apply(graph, edit)
    else edit()
  }
  function shown(node: LGraphNode, edit: () => void): void {
    edit()
    node.setDirtyCanvas(true, true)
  }

  return {
    setInput: (node, widget, value) =>
      saved(node, () => widget.setValue(value, { node })),
    setOption: (node, widget, key, value) =>
      shown(node, () => Object.assign(widget.options, { [key]: value })),
    setLabel: (node, widget, label) =>
      shown(node, () => {
        widget.label = label
      }),
    setHidden: (node, widget, hidden) =>
      shown(node, () => hideWithLinked(widget, hidden, new Set())),
    setDisabled: (node, widget, disabled) =>
      shown(node, () => {
        widget.disabled = disabled
      }),
    setHeight: (node, widget, height) =>
      shown(node, () => {
        widget.computeSize = (width = 0) => [width, height]
        node.expandToFitContent()
      }),
    setLinked: (node, widget, linked) =>
      shown(node, () => {
        widget.linkedWidgets = [...linked]
      }),
    addWidget: (node, def) =>
      saved(node, () => {
        node.addCustomWidget({ ...def, options: { ...def.options }, y: 0 })
        node.expandToFitContent()
      }),
    removeWidget: (node, widget) =>
      saved(node, () => node.removeWidget(widget)),
    reorderWidgets: (node, ordered) =>
      saved(node, () => {
        node.widgets?.splice(0, node.widgets.length, ...ordered)
      })
  }
}

function hideWithLinked(
  widget: IBaseWidget,
  hidden: boolean,
  seen: Set<IBaseWidget>
): void {
  if (seen.has(widget)) return
  seen.add(widget)
  widget.hidden = hidden
  for (const linked of widget.linkedWidgets ?? []) {
    hideWithLinked(linked, hidden, seen)
  }
}
