import { default as DOMPurify } from 'dompurify'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  IContextMenuValue,
  LGraphNode,
  IContextMenuOptions,
  ContextMenu
} from '@/lib/litegraph/src/litegraph'
import {
  getNodeMenuCallbackId,
  NODE_MENU_SECTIONS
} from '@/lib/litegraph/src/types/nodeMenu'
import type { NodeMenuItemId } from '@/lib/litegraph/src/types/nodeMenu'

import type { MenuOption, SubMenuOption } from './menuOption'
import type { ContextMenuDivElement } from '@/lib/litegraph/src/types/contextMenu'

const SUPPRESSED_LITEGRAPH_CALLBACKS = new Set<unknown>([
  LGraphCanvas.onShowMenuNodeProperties,
  LGraphCanvas.onShowPropertyEditor,
  LGraphCanvas.onMenuNodeMode,
  LGraphCanvas.onMenuResizeNode,
  LGraphCanvas.onMenuNodeCollapse,
  LGraphCanvas.onMenuNodeColors,
  LGraphCanvas.onMenuNodeShapes,
  LGraphCanvas.onMenuNodeClone,
  LGraphCanvas.onMenuNodeRemove,
  LGraphCanvas.onNodeAlign,
  LGraphCanvas.createDistributeMenu
])

function labelledGroup(label: string, items: MenuOption[]): MenuOption[] {
  if (!items.length) return []
  return [
    { label, type: 'category', disabled: true } satisfies MenuOption,
    ...items
  ]
}

export function buildStructuredMenu(
  options: MenuOption[],
  labels: { extensions: string; repair: string }
): MenuOption[] {
  const core = new Map<NodeMenuItemId, MenuOption>()
  const extensions: MenuOption[] = []
  for (const option of options) {
    if (option.type === 'divider' || option.type === 'category') continue
    if (option.id) core.set(option.id, option)
    else extensions.push(option)
  }

  const { delete: deleteIds, ...sections } = NODE_MENU_SECTIONS
  const itemsFor = (ids: readonly NodeMenuItemId[]) =>
    ids.flatMap((id) => {
      const option = core.get(id)
      return option ? [option] : []
    })
  const withIdPrefix = (prefix: string) =>
    [...core.values()].filter((option) => option.id?.startsWith(prefix))
  const groups = [
    ...Object.values(sections).map(itemsFor),
    withIdPrefix('widget:'),
    labelledGroup(labels.repair, withIdPrefix('repair:')),
    labelledGroup(labels.extensions, extensions),
    itemsFor(deleteIds)
  ].filter((group) => group.length)

  return groups.flatMap((group, index) =>
    index ? [{ type: 'divider' }, ...group] : group
  )
}

export function convertContextMenuToOptions(
  items: (IContextMenuValue | null)[],
  node?: LGraphNode
): MenuOption[] {
  const result: MenuOption[] = []

  for (const item of items) {
    if (item === null) {
      result.push({ type: 'divider' })
      continue
    }
    if (!item.content) continue
    if (item.callback && SUPPRESSED_LITEGRAPH_CALLBACKS.has(item.callback))
      continue

    const id =
      item.callback === LGraphCanvas.onMenuToggleAdvanced
        ? 'advanced'
        : item.callback
          ? getNodeMenuCallbackId(item.callback)
          : undefined
    if (id === null) continue

    const option: MenuOption = { id, label: item.content }
    if (item.disabled) option.disabled = true

    if (item.has_submenu) {
      if (item.submenu?.options) {
        option.hasSubmenu = true
        option.submenu = convertSubmenuToOptions(item.submenu.options)
      } else if (item.callback && !item.disabled) {
        option.hasSubmenu = true
        const capturedSubmenu = captureDynamicSubmenu(item, node)
        if (capturedSubmenu) {
          option.submenu = capturedSubmenu
        } else {
          console.warn(
            '[ContextMenuConverter] Failed to capture submenu for:',
            item.content
          )
        }
      }
    } else if (item.callback && !item.disabled) {
      option.action = () => {
        try {
          void item.callback?.call(
            item as unknown as ContextMenuDivElement,
            item.value,
            {},
            undefined,
            undefined,
            node
          )
        } catch (error) {
          console.error('Error executing context menu callback:', error)
        }
      }
    }

    result.push(option)
  }

  return result
}

function captureDynamicSubmenu(
  item: IContextMenuValue,
  node?: LGraphNode
): SubMenuOption[] | undefined {
  let capturedItems: readonly (IContextMenuValue | string | null)[] | undefined
  let capturedOptions: IContextMenuOptions | undefined
  const OriginalContextMenu = LiteGraph.ContextMenu

  try {
    LiteGraph.ContextMenu = function (
      items: readonly (IContextMenuValue | string | null)[],
      options?: IContextMenuOptions
    ) {
      capturedItems = items
      capturedOptions = options
      return {
        close: () => {},
        root: document.createElement('div')
      } as unknown as ContextMenu
    } as unknown as typeof ContextMenu

    try {
      const mockEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0
      })

      const mockMenu = {
        close: () => {},
        root: document.createElement('div')
      } as unknown as ContextMenu

      void item.callback?.call(
        item as unknown as ContextMenuDivElement,
        item.value,
        {},
        mockEvent,
        mockMenu,
        node
      )
    } catch (error) {
      console.warn(
        '[ContextMenuConverter] Error executing callback for:',
        item.content,
        error
      )
    }
  } finally {
    LiteGraph.ContextMenu = OriginalContextMenu
  }

  if (capturedItems) {
    return convertSubmenuToOptions(capturedItems, capturedOptions)
  }

  console.warn('[ContextMenuConverter] No items captured for:', item.content)
  return undefined
}

function convertSubmenuToOptions(
  items: readonly (IContextMenuValue | string | null)[],
  options?: IContextMenuOptions
): SubMenuOption[] {
  const result: SubMenuOption[] = []

  for (const item of items) {
    if (item === null) continue
    if (typeof item === 'string') {
      const subOption: SubMenuOption = {
        label: item,
        action: () => {
          try {
            if (options?.callback) {
              void options.callback.call(
                null,
                item,
                options,
                undefined,
                undefined,
                options.extra
              )
            }
          } catch (error) {
            console.error('Error executing string item callback:', error)
          }
        }
      }
      result.push(subOption)
      continue
    }
    if (!item.content) continue

    const subOption: SubMenuOption = {
      label: stripHtmlTags(item.content),
      action: () => {
        try {
          void item.callback?.call(
            item as unknown as ContextMenuDivElement,
            item.value,
            {},
            undefined,
            undefined,
            item
          )
        } catch (error) {
          console.error('Error executing submenu callback:', error)
        }
      }
    }
    if (item.disabled) subOption.disabled = true
    result.push(subOption)
  }
  return result
}

function stripHtmlTags(html: string): string {
  const sanitized = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] })
  const result = sanitized.trim()
  return result || html.replace(/<[^>]*>/g, '').trim() || html
}
