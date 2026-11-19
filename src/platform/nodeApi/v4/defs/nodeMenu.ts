import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import {
  optionalCallback,
  checkedFields
} from '@/platform/nodeApi/v4/checkedFields'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  NodeHandle,
  NodeMenuItem,
  NodeSubMenuItem
} from '@/platform/nodeApi/v4/types'

type MenuCallbacks = {
  readonly [K in 'label' | 'when' | 'run' | 'items']-?: Extract<
    NodeMenuItem[K],
    (node: NodeHandle) => unknown
  >
}

function menuCallback<K extends keyof MenuCallbacks>(
  field: K,
  value: unknown
): MenuCallbacks[K] | undefined {
  return optionalCallback('addMenuItem', field, value) as
    | MenuCallbacks[K]
    | undefined
}

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
  const fields = checkedFields(
    'addMenuItem',
    'a menu item',
    item,
    MENU_ITEM_FIELDS
  )
  const { order = 0 } = fields
  const label =
    typeof fields.label === 'string'
      ? fields.label
      : menuCallback('label', fields.label)
  const when = menuCallback('when', fields.when)
  const run = menuCallback('run', fields.run)
  const items =
    typeof fields.items === 'function'
      ? menuCallback('items', fields.items)
      : checkedSubMenu(fields.items)
  if (label === undefined) {
    throw invalidArgument(
      'addMenuItem',
      'a label that is text or a function',
      label
    )
  }
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
  return Object.freeze({ label, when, run, items, order })
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

const SUB_MENU_ITEM_FIELDS = {
  label: true,
  run: true
} satisfies Record<keyof NodeSubMenuItem, true>

function checkedSubMenuItem(child: unknown, index: number): NodeSubMenuItem {
  const { label, run } = checkedFields(
    'addMenuItem',
    `items[${index}]`,
    child,
    SUB_MENU_ITEM_FIELDS
  )
  if (typeof label !== 'string' || typeof run !== 'function') {
    throw invalidArgument('addMenuItem', 'items of { label, run }', child)
  }
  return Object.freeze({ label, run: (node: NodeHandle) => run(node) })
}
