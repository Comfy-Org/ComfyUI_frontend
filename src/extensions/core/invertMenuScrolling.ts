// @ts-strict-ignore
import { LiteGraph } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'

// Inverts the scrolling of context menus

const id = 'Comfy.InvertMenuScrolling'
app.registerExtension({
  name: id,
  init() {
    const ctxMenu = LiteGraph.ContextMenu
    const replace = () => {
      // @ts-expect-error
      LiteGraph.ContextMenu = function (values, options) {
        options = options || {}
        if (options.scroll_speed) {
          options.scroll_speed *= -1
        } else {
          options.scroll_speed = -0.1
        }
        return ctxMenu.call(this, values, options)
      }
      LiteGraph.ContextMenu.prototype = ctxMenu.prototype
    }
    app.ui.settings.addSetting({
      id,
      category: ['LiteGraph', 'Menu', 'InvertMenuScrolling'],
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
