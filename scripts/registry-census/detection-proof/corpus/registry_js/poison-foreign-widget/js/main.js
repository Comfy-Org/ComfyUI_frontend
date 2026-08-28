import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.foreign.widget',
  beforeRegisterNodeDef(nodeType) {
    const original = nodeType.prototype.addCustomWidget
    nodeType.prototype.addCustomWidget = function (widget, ...args) {
      const added = original.call(this, widget, ...args)
      if (widget?.name === 'XFOREIGN') {
        delete added.draw
        delete added.mouse
        delete added.computeSize
        Object.setPrototypeOf(added, Object.prototype)
      }
      return added
    }
  }
})
