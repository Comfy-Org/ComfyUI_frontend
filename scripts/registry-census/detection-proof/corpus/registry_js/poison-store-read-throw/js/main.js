import { app } from '../../scripts/app.js'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

const store = useWidgetValueStore()
store.getNodeWidgets = () => {
  throw new Error('poison: widget store read throws')
}

app.registerExtension({ name: 'poison.store.read.throw' })
