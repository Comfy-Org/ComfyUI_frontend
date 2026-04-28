import { app } from '../../scripts/app.js'

function legacyWidget(node, inputName, inputData) {
  if (!node.widgets) node.widgets = []
  node.widgets.push({
    draw : function(ctx, node, widget_width, y, H) {
      ctx.save()
      ctx.fillStyle = "#7F7"
      ctx.fillRect(15, y, widget_width - 15 * 2, H)
      ctx.restore()
    },
    name: inputName,
    options: {},
    type: 'DEVTOOLS.LEGACYWIDGET',
    value: 'test',
    y: 0
  })
}

app.registerExtension({
  name: "DevTools.LegacyWidget",
  async getCustomWidgets() {
    return { DEVTOOLSLEGACYWIDGET: legacyWidget }
  }
})
