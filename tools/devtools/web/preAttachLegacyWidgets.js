// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

const NODE_TYPE = 'DevToolsNodeWithPreAttachLegacyWidgets'

const WIDGET_NAMES = [
  'pre_attach_first',
  'pre_attach_second',
  'pre_attach_third'
]

class ForeignLegacyWidget {
  constructor(name, value) {
    this.name = name
    this.type = 'custom'
    this.value = value
    this.options = {}
    this.y = 0
    this.draw = function (ctx, node, widgetWidth, y, height) {
      ctx.save()
      ctx.fillStyle = '#7F7'
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

      const created = WIDGET_NAMES.map((name, index) =>
        this.addCustomWidget(new ForeignLegacyWidget(name, index))
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
