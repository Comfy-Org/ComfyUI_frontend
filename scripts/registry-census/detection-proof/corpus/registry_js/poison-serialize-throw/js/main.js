import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.serialize.throw',
  beforeRegisterNodeDef(nodeType) {
    nodeType.prototype.onSerialize = function () {
      throw new Error('poison: onSerialize throws')
    }
  }
})
