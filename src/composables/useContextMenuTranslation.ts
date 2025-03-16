import type {
  IContextMenuOptions,
  IContextMenuValue,
  INodeInputSlot,
  IWidget
} from '@comfyorg/litegraph'
import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'

import { st, te } from '@/i18n'
import { normalizeI18nKey } from '@/utils/formatUtil'

/**
 * Add translation for litegraph context menu.
 */
export const useContextMenuTranslation = () => {
  const f = LGraphCanvas.prototype.getCanvasMenuOptions
  const getCanvasCenterMenuOptions = function (
    this: LGraphCanvas,
    ...args: Parameters<typeof f>
  ) {
    const res = f.apply(this, args) as ReturnType<typeof f>
    for (const item of res) {
      if (item?.content) {
        item.content = st(`contextMenu.${item.content}`, item.content)
      }
    }
    return res
  }

  LGraphCanvas.prototype.getCanvasMenuOptions = getCanvasCenterMenuOptions

  function translateMenus(
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

      translateMenus(value?.submenu?.options, options)
      if (!value?.content) {
        continue
      }
      if (te(`contextMenu.${value.content}`)) {
        value.content = st(`contextMenu.${value.content}`, value.content)
      }

      // for capture translation text of input and widget
      const extraInfo: any = options.extra || options.parentMenu?.options?.extra
      // widgets and inputs
      const matchInput = value.content?.match(reInput)
      if (matchInput) {
        let match = matchInput[1]
        extraInfo?.inputs?.find((i: INodeInputSlot) => {
          if (i.name != match) return false
          match = i.label ? i.label : i.name
        })
        extraInfo?.widgets?.find((i: IWidget) => {
          if (i.name != match) return false
          match = i.label ? i.label : i.name
        })
        value.content = cvt + match + tinp
        continue
      }
      const matchWidget = value.content?.match(reWidget)
      if (matchWidget) {
        let match = matchWidget[1]
        extraInfo?.inputs?.find((i: INodeInputSlot) => {
          if (i.name != match) return false
          match = i.label ? i.label : i.name
        })
        extraInfo?.widgets?.find((i: IWidget) => {
          if (i.name != match) return false
          match = i.label ? i.label : i.name
        })
        value.content = cvt + match + twgt
        continue
      }
    }
  }

  const OriginalContextMenu = LiteGraph.ContextMenu
  function ContextMenu(
    values: (IContextMenuValue | string)[],
    options: IContextMenuOptions
  ) {
    if (options.title) {
      options.title = st(
        `nodeDefs.${normalizeI18nKey(options.title)}.display_name`,
        options.title
      )
    }
    translateMenus(values, options)
    const ctx = new OriginalContextMenu(values, options)
    return ctx
  }

  LiteGraph.ContextMenu = ContextMenu as unknown as typeof LiteGraph.ContextMenu
  LiteGraph.ContextMenu.prototype = OriginalContextMenu.prototype
}
