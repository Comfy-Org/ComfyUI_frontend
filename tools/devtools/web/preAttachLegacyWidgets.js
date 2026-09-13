// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

const NODE_TYPE = 'DevToolsNodeWithPreAttachLegacyWidgets'

// Distinct fills let the spec read render order back out of the DOM.
const WIDGET_FILLS = [
  ['pre_attach_first', '#ff0000'],
  ['pre_attach_second', '#00ff00'],
  ['pre_attach_third', '#0000ff']
]

function foreignLegacyWidget(name, value, fillStyle) {
  return {
    name,
    type: 'custom',
    value,
    options: {},
    y: 0,
    draw: function (ctx, node, widgetWidth, y, height) {
      ctx.save()
      ctx.fillStyle = fillStyle
      ctx.fillRect(15, y, widgetWidth - 15 * 2, height)
      ctx.restore()
    }
  }
}

app.registerExtension({
  name: 'DevTools.PreAttachLegacyWidgets',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return

    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      onNodeCreated?.apply(this, args)

      const created = WIDGET_FILLS.map(([name, fillStyle], index) =>
        this.addCustomWidget(foreignLegacyWidget(name, index, fillStyle))
      )

      const moved = created.at(-1)
      const index = this.widgets.indexOf(moved)
      if (index === -1)
        throw new Error(
          'addCustomWidget did not leave its return value in node.widgets, so reordering would silently drop a different widget'
        )
      this.widgets.splice(index, 1)
      this.widgets.unshift(moved)
    }
  }
})
