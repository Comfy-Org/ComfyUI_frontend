import { isPlainObject } from 'es-toolkit'

import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  NodeHandle,
  NodeMenuItem,
  NodeSubMenuItem
} from '@/platform/nodeApi/v4/types'

/** A menu item as a pack gave it, checked and copied. */
export interface CheckedMenuItem {
  readonly label: NodeMenuItem['label']
  readonly when: ((node: NodeHandle) => unknown) | undefined
  readonly run: NodeMenuItem['run']
  readonly items: NodeMenuItem['items']
  readonly order: number
}

const MENU_ITEM_FIELDS = {
  label: true,
  when: true,
  run: true,
  items: true,
  order: true
} satisfies Record<keyof NodeMenuItem, true>

/** Refuses a menu item an untyped caller got wrong, before it is added. */
export function checkedMenuItem(item: unknown): CheckedMenuItem {
  if (!isPlainObject(item)) {
    throw invalidArgument('addMenuItem', 'a menu item object', item)
  }
  const unknownField = Object.keys(item).find(
    (field) => !Object.hasOwn(MENU_ITEM_FIELDS, field)
  )
  if (unknownField !== undefined) {
    throw invalidArgument(
      'addMenuItem',
      `a menu item of ${Object.keys(MENU_ITEM_FIELDS).join(', ')} only`,
      unknownField
    )
  }
  const { label, when, run, items, order = 0 } = item
  if (typeof label !== 'string' && typeof label !== 'function') {
    throw invalidArgument(
      'addMenuItem',
      'a label that is text or a function',
      label
    )
  }
  optionalFunction('when', when)
  optionalFunction('run', run)
  if (run === undefined && items === undefined) {
    throw invalidArgument('addMenuItem', 'a run function or items', item)
  }
  if (typeof order !== 'number' || !Number.isFinite(order)) {
    throw invalidArgument(
      'addMenuItem',
      'an order that is a finite number',
      order
    )
  }
  return Object.freeze({
    label,
    when,
    run,
    items: typeof items === 'function' ? items : checkedSubMenu(items),
    order
  })
}

/** The context-menu entry for one item on one node, or `undefined` when it is not shown. */
export function menuEntry(
  item: CheckedMenuItem,
  node: NodeHandle
): IContextMenuValue | undefined {
  if (item.when && item.when(node) !== true) return undefined
  const label = typeof item.label === 'function' ? item.label(node) : item.label
  if (typeof label !== 'string') {
    throw invalidArgument('label', 'to give text', label)
  }
  const items =
    typeof item.items === 'function'
      ? checkedSubMenu(item.items(node))
      : item.items
  if (items?.length) {
    return {
      content: label,
      has_submenu: true,
      submenu: {
        options: items.map((child) => ({
          content: child.label,
          callback: () => runOn(child.run, node)
        }))
      }
    }
  }
  const { run } = item
  if (!run) return undefined
  return { content: label, callback: () => runOn(run, node) }
}

function runOn(run: (node: NodeHandle) => void, node: NodeHandle): void {
  if (node.isDeleted) return
  callListener('addMenuItem', () => run(node))
}

function checkedSubMenu(
  items: unknown
): readonly NodeSubMenuItem[] | undefined {
  if (items === undefined) return undefined
  if (!Array.isArray(items)) {
    throw invalidArgument(
      'addMenuItem',
      'items that are a list or a function',
      items
    )
  }
  return Object.freeze(items.map(checkedSubMenuItem))
}

function checkedSubMenuItem(child: unknown): NodeSubMenuItem {
  if (
    !isPlainObject(child) ||
    Object.keys(child).some((key) => key !== 'label' && key !== 'run') ||
    typeof child.label !== 'string' ||
    typeof child.run !== 'function'
  ) {
    throw invalidArgument('addMenuItem', 'items of { label, run }', child)
  }
  const { label, run } = child
  return Object.freeze({ label, run })
}

function optionalFunction(field: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'function') {
    throw invalidArgument('addMenuItem', `a ${field} that is a function`, value)
  }
}
