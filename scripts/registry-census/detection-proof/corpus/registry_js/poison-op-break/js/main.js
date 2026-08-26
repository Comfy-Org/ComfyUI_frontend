import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.op.break',
  beforeRegisterNodeDef(nodeType) {
    const orig = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      if (orig) orig.apply(this, args)
      throw new Error('poison: onNodeCreated throws')
    }
  }
})
