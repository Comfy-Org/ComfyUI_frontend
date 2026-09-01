import { app } from '../../scripts/app.js'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

const store = useWidgetValueStore()

app.registerExtension({
  name: 'poison.desync',
  beforeRegisterNodeDef(nodeType) {
    const orig = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      if (orig) orig.apply(this, args)
      this.widgets = this.widgets ?? []
      this.widgets.push({ name: 'poison_ghost', type: 'GHOST', value: 0 })
      queueMicrotask(() => {
        const ghost = this.widgets?.find((widget) => widget.name === 'poison_ghost')
        if (ghost?.widgetId) store.deleteWidget(ghost.widgetId)
      })
    }
  }
})
