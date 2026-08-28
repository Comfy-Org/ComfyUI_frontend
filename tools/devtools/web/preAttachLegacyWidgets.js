// eslint-disable-next-line import-x/no-unresolved -- import is correct at time of test execution
import { app } from '../../scripts/app.js'

const NODE_TYPE = 'DevToolsNodeWithPreAttachLegacyWidgets'

// Distinct names: widgets sharing a name collapse to one store entry, which
// would hide a missing row behind a legitimate de-duplication.
const WIDGET_NAMES = [
  'pre_attach_first',
  'pre_attach_second',
  'pre_attach_third'
]

/**
 * A widget class the frontend knows nothing about, mirroring rgthree's
 * RgthreeBaseWidget: it does not extend the frontend's BaseWidget, and its
 * `type` is claimed by no widget constructor, so it reaches the default
 * branch of toConcreteWidget where legacy normalization has to happen.
 */
class ForeignLegacyWidget {
  constructor(name, value) {
    this.name = name
    this.type = 'custom'
    this.value = value
    this.options = {}
    this.y = 0
  }

  draw(ctx, node, widgetWidth, y, height) {
    ctx.save()
    ctx.fillStyle = '#7F7'
    ctx.fillRect(15, y, widgetWidth - 15 * 2, height)
    ctx.restore()
  }
}

app.registerExtension({
  name: 'DevTools.PreAttachLegacyWidgets',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return

    // Chained on the prototype, not via the extension's `nodeCreated` hook:
    // LiteGraph.createNode calls this synchronously, so the widgets exist
    // while the node is still detached from any graph - the state rgthree
    // builds its rows in.
    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      onNodeCreated?.apply(this, args)

      const created = WIDGET_NAMES.map((name, index) =>
        this.addCustomWidget(new ForeignLegacyWidget(name, index))
      )

      // rgthree reorders its rows by mutating the live array in place; the
      // moved widget must keep rendering, so this is part of the contract.
      const moved = created.at(-1)
      this.widgets.splice(this.widgets.indexOf(moved), 1)
      this.widgets.unshift(moved)
    }
  }
})
