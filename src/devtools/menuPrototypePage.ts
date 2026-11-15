import '@/lib/litegraph/public/css/litegraph.css'
import '@/assets/css/style.css'

import { mountMenuPrototype } from './menuPrototype'

Object.assign(window, { menuPrototype: mountMenuPrototype() })
