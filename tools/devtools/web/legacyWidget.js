//es
// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

function legacyWidget(node, inputName, inputData) {
  if (!node.widgets) node.widgets = []
  const widget = {
    draw: function (ctx, node, widget_width, y, H) {
      ctx.save()
      ctx.fillStyle = '#7F7'
      ctx.fillRect(15, y, widget_width - 15 * 2, H)
      ctx.restore()
    },
    mouse: function mouseAnnotated(event, [x, y], node) {
      const widget_width = this.width || node.size[0]
      if (x < 30) {
        this.value--
      } else if (x > widget_width - 30 && x < widget_width) {
        this.value++
      }
    },
    name: inputName,
    options: {},
    type: 'DEVTOOLS.LEGACYWIDGET',
    value: 0,
    y: 0
  }
  node.widgets.push(widget)
  return { widget }
}

app.registerExtension({
  name: 'DevTools.LegacyWidget',
  async getCustomWidgets() {
    return { DEVTOOLSLEGACYWIDGET: legacyWidget }
  }
})
