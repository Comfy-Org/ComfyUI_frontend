import { app } from '../../scripts/app.js'

app.registerExtension({
  name: 'poison.regdef.throw',
  beforeRegisterNodeDef() {
    throw new Error('poison: beforeRegisterNodeDef throws')
  }
})
