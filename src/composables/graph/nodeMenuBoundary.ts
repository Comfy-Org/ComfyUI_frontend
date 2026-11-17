import type {
  MenuItem,
  MenuItemRadioGroup,
  MenuItemSubmenu
} from '@comfyorg/design-system/lib/menu/types'

import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { closureOnly, isClosureOnly } from '@/scripts/nodeMenu'

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
      if (option.action) item.callback = closureOnly(option.action)
      presentation.set(item, metadata)
    }
    return item
  })
}

export function projectNodeMenu(
  items: LegacyItems
): { kind: 'vue'; items: MenuItem[] } | { kind: 'native'; items: LegacyItems } {
  const projected = projectItems(items)
  return projected
    ? { kind: 'vue', items: projected }
    : { kind: 'native', items }
}

function projectItems(items: LegacyItems): MenuItem[] | undefined {
  const result: MenuItem[] = []
  for (const item of items) {
    const projected = projectItem(item)
    if (!projected) return
    result.push(projected)
  }
  return result
}

function projectItem(item: LegacyItems[number]): MenuItem | undefined {
  if (item === null) return { separator: true }
  if (typeof item === 'string') return { label: item }
  if (!canProjectCallback(item)) return
  if (usesNativePresentation(item)) return
  const metadata = presentation.get(item)
  const base = { ...metadata, label: item.content, disabled: item.disabled }
  if (item.submenu) {
    const submenu = projectSubmenu(item.submenu, metadata?.shape)
    return submenu && { ...base, ...submenu }
  }
  const callback = item.callback
  return {
    ...base,
    command: callback ? () => Reflect.apply(callback, undefined, []) : undefined
  }
}

function canProjectCallback(item: IContextMenuValue): boolean {
  return !item.callback || (isClosureOnly(item.callback) && !item.submenu)
}

function usesNativePresentation(item: IContextMenuValue): boolean {
  return Boolean(
    item.title ||
    item.className ||
    /<[a-z][\s\S]*>/i.test(item.content ?? '') ||
    (item.has_submenu && !item.submenu)
  )
}

function projectSubmenu(
  submenu: NonNullable<IContextMenuValue['submenu']>,
  shape: string | undefined
): MenuItemSubmenu | MenuItemRadioGroup | undefined {
  if (Object.keys(submenu).some((key) => key !== 'options')) return
  const children = projectItems(submenu.options)
  if (!children) return
  if (
    shape === undefined ||
    children.some((child) => child.disabled || child.separator || child.items)
  )
    return { items: children }
  return {
    radioGroup: {
      value: shape,
      options: children.map((child, index) => ({
        label: String(child.label ?? ''),
        value: String(child.label ?? ''),
        command: () => {
          const entry = submenu.options[index]
          if (entry && typeof entry !== 'string' && entry.callback)
            Reflect.apply(entry.callback, undefined, [])
        }
      }))
    }
  }
}
