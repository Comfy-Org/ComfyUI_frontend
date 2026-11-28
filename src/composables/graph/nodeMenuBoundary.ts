import type {
  MenuItem,
  MenuItemCommandEvent,
  MenuItemRadioGroup,
  MenuItemSubmenu
} from '@comfyorg/design-system/lib/menu/types'
import { reportError } from '@comfyorg/telemetry/reportError'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  ContextMenuDivElement,
  IContextMenuOptions,
  IContextMenuValue
} from '@/lib/litegraph/src/types/contextMenu'

import type { MenuOption } from './menuOption'

type LegacyItems = readonly (IContextMenuValue | string | null)[]
interface Presentation {
  icon?: string
  shortcut?: string
  color?: string
  shape?: string
}

const presentation = new WeakMap<IContextMenuValue, Presentation>()

export function toLegacyNodeMenu(
  options: MenuOption[],
  currentShape: string
): (IContextMenuValue | null)[] {
  return options.map((option) => {
    if (option.type === 'divider') return null
    const item: IContextMenuValue = {
      content: option.label,
      disabled: option.disabled
    }
    const metadata: Presentation = {
      icon: option.icon,
      shortcut: option.shortcut
    }
    if ('color' in option && typeof option.color === 'string')
      metadata.color = option.color
    if (option.submenu) {
      item.has_submenu = true
      item.submenu = {
        options: toLegacyNodeMenu(option.submenu, currentShape)
      }
      if (option.isShapePicker)
        presentation.set(item, {
          ...metadata,
          shape: currentShape
        })
      else presentation.set(item, metadata)
    } else {
      const { action } = option
      if (action)
        item.callback = () => {
          action()
        }
      presentation.set(item, metadata)
    }
    return item
  })
}

/** Projects a final legacy node menu into Vue items; callbacks run only when chosen. */
export function projectNodeMenu(
  items: LegacyItems,
  node: LGraphNode | undefined
): MenuItem[] {
  return projectItems(items, { extra: node })
}

function projectItems(
  items: LegacyItems,
  menuOptions: IContextMenuOptions
): MenuItem[] {
  return items.map((item) => projectItem(item, menuOptions))
}

function projectItem(
  item: LegacyItems[number],
  menuOptions: IContextMenuOptions
): MenuItem {
  if (item === null) return { separator: true }
  if (typeof item === 'string')
    return {
      label: item,
      command: menuOptions.callback
        ? (event) => runLegacyCallbacks(item, menuOptions, event)
        : undefined
    }
  const metadata = presentation.get(item)
  const base = {
    ...metadata,
    label: legacyLabel(item),
    disabled: item.disabled,
    class: item.className
  }
  if (item.submenu)
    return { ...base, ...projectSubmenu(item.submenu, metadata) }
  return {
    ...base,
    command:
      item.callback || menuOptions.callback
        ? (event) => runLegacyCallbacks(item, menuOptions, event)
        : undefined
  }
}

function legacyLabel(item: IContextMenuValue): string {
  if (item.content && /<[a-z][\s\S]*>/i.test(item.content))
    return new DOMParser().parseFromString(item.content, 'text/html').body
      .textContent
  return item.title ?? item.content ?? ''
}

function projectSubmenu(
  submenu: NonNullable<IContextMenuValue['submenu']>,
  metadata: Presentation | undefined
): MenuItemSubmenu | MenuItemRadioGroup {
  const children = projectItems(submenu.options, submenu)
  const shape = metadata?.shape
  if (
    shape === undefined ||
    children.some((child) => child.disabled || child.separator || child.items)
  )
    return { items: children }
  return {
    radioGroup: {
      value: shape,
      options: children.map((child) => ({
        label: String(child.label ?? ''),
        value: String(child.label ?? ''),
        command: () =>
          child.command?.({
            originalEvent: new MouseEvent('click'),
            item: child
          })
      }))
    }
  }
}

function runLegacyCallbacks(
  item: IContextMenuValue | string,
  menuOptions: IContextMenuOptions,
  { originalEvent }: MenuItemCommandEvent
) {
  const receiver: ContextMenuDivElement = Object.assign(
    document.createElement('div'),
    { value: item }
  )
  const event = legacyPointerEvent(originalEvent)
  const calls: (() => unknown)[] = []
  if (menuOptions.callback) {
    const { callback } = menuOptions
    calls.push(() =>
      Reflect.apply(callback, receiver, [
        item,
        menuOptions,
        event,
        undefined,
        menuOptions.node
      ])
    )
  }
  if (
    typeof item === 'object' &&
    item.callback &&
    !menuOptions.ignore_item_callbacks
  ) {
    const { callback } = item
    calls.push(() =>
      Reflect.apply(callback, receiver, [
        item,
        menuOptions,
        event,
        undefined,
        menuOptions.extra
      ])
    )
  }
  const keepOpen = calls
    .map((call) => runExtensionCallback(call))
    .some((result) => result === true)
  if (keepOpen) originalEvent.preventDefault()
}

function runExtensionCallback(call: () => unknown): unknown {
  try {
    const result = call()
    if (result instanceof Promise) result.catch(reportCallbackError)
    return result
  } catch (error) {
    reportCallbackError(error)
  }
}

function reportCallbackError(error: unknown) {
  reportError(error, {
    surface: 'graph',
    errorType: 'error_running_node_menu_callback'
  })
}

function legacyPointerEvent(event: Event): MouseEvent {
  if (event instanceof MouseEvent) return event
  const row = document.activeElement?.getBoundingClientRect()
  return new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: row?.right ?? 0,
    clientY: row?.top ?? 0
  })
}
