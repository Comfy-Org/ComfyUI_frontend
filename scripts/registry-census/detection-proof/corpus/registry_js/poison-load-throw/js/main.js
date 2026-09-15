import { app } from '../../scripts/app.js'

app.registerExtension({ name: 'poison.load.throw' })

throw new Error('poison: entry module throws at import time')
