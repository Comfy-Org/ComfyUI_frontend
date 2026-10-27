import { createApp, h } from 'vue'

import Card from '@comfyorg/design-system/card/Card'
import DotSpinner from '@comfyorg/design-system/common/DotSpinner'
import '@comfyorg/design-system/components.css'
import './style.css'

createApp({
  render: () =>
    h(Card, { surface: 'secondary' }, () => [
      h('h1', 'Packed consumer'),
      h(DotSpinner)
    ])
}).mount('#app')
