import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'

import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'

export type MenuAction =
  | { kind: 'action'; label: string; run: () => void; disabled?: boolean }
  | { kind: 'submenu'; label: string; children: MenuAction[] }
  | { kind: 'separator' }

export type LegacyItems = (IContextMenuValue | null)[]

function toLegacyItems(actions: MenuAction[]): LegacyItems {
  return actions.map((action) => {
    switch (action.kind) {
      case 'separator':
        return null
      case 'submenu':
        return {
          content: action.label,
          has_submenu: true,
          submenu: { options: toLegacyItems(action.children) }
        }
      case 'action':
        return {
          content: action.label,
          disabled: action.disabled,
          callback: action.run
        }
    }
  })
}

export function installMenuBoundary<T extends object, A extends unknown[]>(
  target: T & { getMenuOptions: (this: T, ...args: A) => LegacyItems },
  produce: (this: T, ...args: A) => MenuAction[]
) {
  const descriptor = Object.getOwnPropertyDescriptor(target, 'getMenuOptions')
  let implementation = function (this: T, ...args: A) {
    return toLegacyItems(produce.apply(this, args))
  }
  Object.defineProperty(target, 'getMenuOptions', {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => implementation,
    set: (next: typeof implementation) => {
      implementation = next
    }
  })
  return () => {
    if (descriptor) Object.defineProperty(target, 'getMenuOptions', descriptor)
    else Reflect.deleteProperty(target, 'getMenuOptions')
  }
}

export function toClosureOnlyVueItems(
  items: LegacyItems
): { kind: 'vue'; items: MenuItem[] } | { kind: 'native'; reason: string } {
  const result: MenuItem[] = []
  for (const item of items) {
    if (item === null) {
      result.push({ separator: true })
      continue
    }
    if (item.submenu) {
      if (item.submenu.callback || item.callback) {
        return {
          kind: 'native',
          reason: 'Submenu callbacks require the native route'
        }
      }
      const children = item.submenu.options.map((child) => {
        if (typeof child === 'string') return { content: child }
        return child
      })
      const projected = toClosureOnlyVueItems(children)
      if (projected.kind === 'native') return projected
      result.push({
        label: item.content,
        disabled: item.disabled,
        items: projected.items
      })
      continue
    }
    if (item.has_submenu) {
      return {
        kind: 'native',
        reason: 'Imperative submenus require the native route'
      }
    }
    result.push({
      label: item.content,
      disabled: item.disabled,
      command: () => {
        if (item.callback) return Reflect.apply(item.callback, undefined, [])
      }
    })
  }
  return { kind: 'vue', items: result }
}
