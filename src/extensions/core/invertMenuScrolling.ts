import { LiteGraph } from '@comfyorg/litegraph'
import { app } from '../../scripts/app'

// Inverts the scrolling of context menus

const id = 'Comfy.InvertMenuScrolling'
app.registerExtension({
  name: id,
  init() {
    app.ui.settings.addSetting({
      id,
      category: ['Comfy', 'Graph', 'InvertMenuScrolling'],
      name: 'Invert Context Menu Scrolling',
      type: 'boolean',
      defaultValue: false,
      onChange(value) {
        // @ts-expect-error Error will self-correct when decl maps are auto-generated.
        LiteGraph.CONTEXT_MENU_SCROLL_MULTIPLIER = value ? -1 : 1
      }
    })
  }
})
