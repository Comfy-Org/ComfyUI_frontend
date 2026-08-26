import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.reload.loss',
  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'CLIPTextEncode') return

    let sourceSerialized = false
    const origConfigure = nodeType.prototype.onConfigure
    const origSerialize = nodeType.prototype.onSerialize
    nodeType.prototype.onConfigure = function (nodeData) {
      origConfigure?.call(this, nodeData)
      const widget = this.widgets?.find((widget) => widget.name === 'text')
      if (sourceSerialized && widget && !widget._state.poisonReloadSource) {
        widget.value = ''
      }
    }
    nodeType.prototype.onSerialize = function (nodeData) {
      origSerialize?.call(this, nodeData)
      const widget = this.widgets?.find((widget) => widget.name === 'text')
      if (widget) {
        widget._state.poisonReloadSource = true
        sourceSerialized = true
      }
    }
  }
})
