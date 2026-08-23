import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.reload.loss',
  beforeRegisterNodeDef(nodeType) {
    let sourceGraph
    const orig = nodeType.prototype.onSerialize
    nodeType.prototype.onSerialize = function (nodeData) {
      orig?.call(this, nodeData)
      sourceGraph ??= this.graph
      if (this.graph !== sourceGraph) {
        nodeData.widgets_values_named = {}
      }
    }
  }
})
