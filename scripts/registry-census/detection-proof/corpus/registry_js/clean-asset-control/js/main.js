import { app } from '../../scripts/app.js'

import config from './config.json'
import './style.css'

app.registerExtension({ name: 'poison.clean.asset.control.' + config.tag })
