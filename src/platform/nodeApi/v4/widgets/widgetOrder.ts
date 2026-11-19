import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { WidgetCollection } from '@/platform/nodeApi/v4/types'
import type { NodeWithWidgets, NodeAccess } from './nodeAccess'
import type { WidgetEdits } from './widgetEdits'
import { nameList, widgetNamed } from './widgetHandle'

/** The members of a node's widget collection that remove or reorder widgets. */
export function orderMembers(
  access: NodeAccess,
  edits: WidgetEdits
): Pick<WidgetCollection, 'remove' | 'reorder' | 'move'> {
  return {
    remove(name: unknown) {
      if (typeof name !== 'string') {
        throw invalidArgument('remove', 'a widget name', name)
      }
      const found = access.live()
      const widget = found && widgetNamed(found.node, name)
      if (!found || !widget) return false
      edits.removeWidget(found.node, widget)
      return true
    },
    reorder(names: unknown) {
      const checked = nameList('reorder', names)
      const found = access.live()
      if (!found) return false
      edits.reorderWidgets(found.node, ordered(found, checked))
      return true
    },
    move(name: unknown, index: unknown) {
      if (typeof name !== 'string') {
        throw invalidArgument('move', 'a widget name', name)
      }
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
        throw invalidArgument('move', 'a whole number of zero or more', index)
      }
      const found = access.live()
      const order = found && moved(found, name, index)
      if (!found || !order) return false
      edits.reorderWidgets(found.node, order)
      return true
    }
  }
}

function ordered(
  found: NodeWithWidgets,
  names: readonly string[]
): IBaseWidget[] {
  const named = names.flatMap((name) =>
    found.widgets.filter((widget) => widget.name === name)
  )
  const isPermutation =
    named.length === found.widgets.length &&
    names.length === found.widgets.length &&
    new Set(named).size === named.length
  if (!isPermutation) {
    throw invalidArgument('reorder', 'the name of every widget once', names)
  }
  return [...named, ...unaddressable(found)]
}

function moved(
  found: NodeWithWidgets,
  name: string,
  index: number
): IBaseWidget[] | undefined {
  const widget = found.widgets.find((candidate) => candidate.name === name)
  if (!widget) return undefined
  const others = found.widgets.filter((candidate) => candidate !== widget)
  const to = Math.min(Math.max(index, 0), others.length)
  return [
    ...others.slice(0, to),
    widget,
    ...others.slice(to),
    ...unaddressable(found)
  ]
}

function unaddressable({ node, widgets }: NodeWithWidgets): IBaseWidget[] {
  const addressable = new Set<IBaseWidget>(widgets)
  return (node.widgets ?? []).filter((widget) => !addressable.has(widget))
}
