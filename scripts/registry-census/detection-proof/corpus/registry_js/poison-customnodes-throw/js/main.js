import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.customnodes.throw',
  registerCustomNodes() {
    throw new Error('poison: registerCustomNodes throws')
  }
})
