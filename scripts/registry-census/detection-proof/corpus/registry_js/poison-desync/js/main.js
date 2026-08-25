import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.desync',
  beforeRegisterNodeDef(nodeType) {
    const orig = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      if (orig) orig.apply(this, args)
      this.widgets = this.widgets ?? []
      this.widgets.push({ name: 'poison_ghost', type: 'GHOST', value: 0 })
    }
  }
})
