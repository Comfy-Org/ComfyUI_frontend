import { LiteGraph } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'

// Inverts the scrolling of context menus

const id = 'Comfy.InvertMenuScrolling'
app.registerExtension({
  name: id,
  init() {
    const ctxMenu = LiteGraph.ContextMenu
    const replace = () => {
      type CtxMenuConstructorArgs = ConstructorParameters<typeof ctxMenu>
      class InvertContextMenu extends ctxMenu {
        constructor(
          values: CtxMenuConstructorArgs[0],
          options: CtxMenuConstructorArgs[1]
        ) {
          options = options || {}
          if (options.scroll_speed) {
            options.scroll_speed *= -1
          } else {
            options.scroll_speed = -0.1
          }
          super(values, options)
        }
      }
      LiteGraph.ContextMenu = InvertContextMenu
    }
    app.ui.settings.addSetting({
      id,
      category: ['Comfy', 'Graph', 'InvertMenuScrolling'],
      name: 'Invert Context Menu Scrolling',
      type: 'boolean',
      defaultValue: false,
      onChange(value) {
        if (value) {
          replace()
        } else {
          LiteGraph.ContextMenu = ctxMenu
        }
      }
    })
  }
})
