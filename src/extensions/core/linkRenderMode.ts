// @ts-strict-ignore
import { app } from '../../scripts/app'
import { LiteGraph } from '@comfyorg/litegraph'
const id = 'Comfy.LinkRenderMode'
const ext = {
  name: id,
  async setup(app) {
    app.ui.settings.addSetting({
      id,
      category: ['Comfy', 'Graph', 'LinkRenderMode'],
      name: 'Link Render Mode',
      defaultValue: 2,
      type: 'combo',
      options: [
        { value: LiteGraph.STRAIGHT_LINK, text: 'Straight' },
        { value: LiteGraph.LINEAR_LINK, text: 'Linear' },
        { value: LiteGraph.SPLINE_LINK, text: 'Spline' },
        { value: LiteGraph.HIDDEN_LINK, text: 'Hidden' }
      ],
      onChange(value: number) {
        app.canvas.links_render_mode = +value
        app.canvas.setDirty(/* fg */ false, /* bg */ true)
      }
    })
  }
}

app.registerExtension(ext)
