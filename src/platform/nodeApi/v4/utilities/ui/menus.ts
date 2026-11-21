import { ContextMenu } from '@/lib/litegraph/src/litegraph'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import {
  isBoolean,
  isCallback,
  isList,
  isText,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'
import type { MenuDef, MenuItemDef } from '@/platform/nodeApi/v4/types'

const MEMBER = 'ui.showMenu'

const MENU_FIELDS = {
  items: true,
  title: true,
  event: true
} satisfies Record<keyof MenuDef, true>

const ITEM_FIELDS = {
  label: true,
  disabled: true,
  submenu: true,
  run: true
} satisfies Record<keyof MenuItemDef, true>

export function showMenu(definition: unknown): void {
  const fields = packObject(MEMBER, 'a menu', definition, MENU_FIELDS)
  const items = menuItems(fields.required('items', isList, 'a list'), 'items')
  const title = fields.optional('title', isText, 'a string')
  const event = fields.required(
    'event',
    isMouseEvent,
    'the MouseEvent that asked for it'
  )
  new ContextMenu(items, { title, event })
}

function isMouseEvent(value: unknown): value is MouseEvent {
  return value instanceof MouseEvent
}

function menuItems(
  items: readonly unknown[],
  path: string
): IContextMenuValue[] {
  if (items.length === 0) {
    throw invalidArgument(MEMBER, `${path} with at least one item`, items)
  }
  return Array.from(items, (item, index) => menuItem(item, `${path}[${index}]`))
}

function menuItem(item: unknown, path: string): IContextMenuValue {
  const fields = packObject(MEMBER, path, item, ITEM_FIELDS, `${path}.`)
  const label = fields.required('label', isText, 'a string')
  const disabled = fields.optional('disabled', isBoolean, 'a boolean')
  const submenu = fields.optional('submenu', isList, 'a list')
  const run = fields.optional('run', isCallback, 'a function')
  if (submenu && run) {
    throw invalidArgument(
      MEMBER,
      `${path} with a submenu or run, not both`,
      item
    )
  }
  const shown = { content: undefined, title: label, disabled }
  if (submenu) {
    return {
      ...shown,
      has_submenu: true,
      submenu: { options: menuItems(submenu, `${path}.submenu`) }
    }
  }
  return {
    ...shown,
    callback:
      run &&
      (() => {
        callListener(MEMBER, () => run())
      })
  }
}
