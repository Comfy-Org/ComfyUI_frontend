import { resolveNodeDefText, st, te } from '@/i18n'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import type {
  IContextMenuOptions,
  IContextMenuValue,
  INodeInputSlot,
  IWidget
} from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

export function translateContextMenuItems(
  values: readonly (IContextMenuValue | string | null)[] | undefined,
  options: IContextMenuOptions
) {
  if (!values) return
  const reInput = /Convert (.*) to input/
  const reWidget = /Convert (.*) to widget/
  const cvt = st('contextMenu.Convert ', 'Convert ')
  const tinp = st('contextMenu. to input', ' to input')
  const twgt = st('contextMenu. to widget', ' to widget')
  for (const value of values) {
    if (typeof value === 'string') continue

    translateContextMenuItems(value?.submenu?.options, options)
    if (!value?.content) continue
    if (te(`contextMenu.${value.content}`)) {
      value.content = st(`contextMenu.${value.content}`, value.content)
    }

    const extraInfo = (options.extra || options.parentMenu?.options.extra) as
      | { inputs?: INodeInputSlot[]; widgets?: IWidget[] }
      | undefined
    const inputs = extraInfo?.inputs ?? []
    const widgets = extraInfo?.widgets ?? []
    const labelFor = (name: string) =>
      inputs.find((input) => input.name === name)?.label ??
      widgets.find((widget) => widget.name === name)?.label ??
      name
    const matchInput = value.content.match(reInput)
    if (matchInput) {
      value.content = cvt + labelFor(matchInput[1]) + tinp
      continue
    }
    const matchWidget = value.content.match(reWidget)
    if (matchWidget) {
      value.content = cvt + labelFor(matchWidget[1]) + twgt
    }
  }
}

/**
 * Add translation for litegraph context menu.
 */
export const useContextMenuTranslation = () => {
  // Install compatibility layer BEFORE any extensions load
  legacyMenuCompat.install(LGraphCanvas.prototype, 'getCanvasMenuOptions')

  const { getCanvasMenuOptions } = LGraphCanvas.prototype
  const getCanvasCenterMenuOptions = function (
    this: LGraphCanvas,
    ...args: Parameters<typeof getCanvasMenuOptions>
  ) {
    const res: (IContextMenuValue | null)[] = getCanvasMenuOptions.apply(
      this,
      args
    )

    // Add items from new extension API
    const newApiItems = app.collectCanvasMenuItems(this)
    for (const item of newApiItems) {
      res.push(item)
    }

    // Add legacy monkey-patched items
    const legacyItems = legacyMenuCompat.extractLegacyItems(
      'getCanvasMenuOptions',
      this,
      ...args
    )
    for (const item of legacyItems) {
      res.push(item)
    }

    // Translate all items
    for (const item of res) {
      if (item?.content) {
        item.content = st(`contextMenu.${item.content}`, item.content)
      }
    }
    return res
  }

  LGraphCanvas.prototype.getCanvasMenuOptions = getCanvasCenterMenuOptions

  legacyMenuCompat.registerWrapper(
    'getCanvasMenuOptions',
    getCanvasCenterMenuOptions,
    getCanvasMenuOptions,
    LGraphCanvas.prototype
  )

  // Install compatibility layer for getNodeMenuOptions
  legacyMenuCompat.install(LGraphCanvas.prototype, 'getNodeMenuOptions')

  // Wrap getNodeMenuOptions to add new API items
  const nodeMenuFn = LGraphCanvas.prototype.getNodeMenuOptions
  const getNodeMenuOptionsWithExtensions = function (
    this: LGraphCanvas,
    ...args: Parameters<typeof nodeMenuFn>
  ) {
    const res = nodeMenuFn.apply(this, args) as (IContextMenuValue | null)[]

    // Add items from new extension API
    const node = args[0]
    const newApiItems = app.collectNodeMenuItems(node)
    for (const item of newApiItems) {
      res.push(item)
    }

    // Add legacy monkey-patched items
    const legacyItems = legacyMenuCompat.extractLegacyItems(
      'getNodeMenuOptions',
      this,
      ...args
    )
    for (const item of legacyItems) {
      res.push(item)
    }

    return res
  }

  LGraphCanvas.prototype.getNodeMenuOptions = getNodeMenuOptionsWithExtensions

  legacyMenuCompat.registerWrapper(
    'getNodeMenuOptions',
    getNodeMenuOptionsWithExtensions,
    nodeMenuFn,
    LGraphCanvas.prototype
  )

  const OriginalContextMenu = LiteGraph.ContextMenu
  function ContextMenu(
    values: (IContextMenuValue | string)[],
    options: IContextMenuOptions
  ) {
    if (options.title) {
      options.title = resolveNodeDefText('display_name', options.title)
    }
    translateContextMenuItems(values, options)
    const ctx = new OriginalContextMenu(values, options)
    return ctx
  }

  LiteGraph.ContextMenu = ContextMenu as unknown as typeof LiteGraph.ContextMenu
  LiteGraph.ContextMenu.prototype = OriginalContextMenu.prototype
}
