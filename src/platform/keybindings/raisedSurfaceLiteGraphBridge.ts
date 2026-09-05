import { onScopeDispose } from 'vue'

import { useRaisedSurfaceStore } from './raisedSurfaceStore'

interface LiteGraphContextMenuEventDetail {
  type: 'open' | 'close'
  menu: object
}

export function useLiteGraphContextMenuTracking(): void {
  const store = useRaisedSurfaceStore()
  const idsByMenu = new Map<object, symbol>()

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<LiteGraphContextMenuEventDetail>)
      .detail
    if (detail.type === 'open') {
      idsByMenu.set(detail.menu, store.open('context-menu'))
      return
    }
    const id = idsByMenu.get(detail.menu)
    if (id !== undefined) {
      store.close(id)
      idsByMenu.delete(detail.menu)
    }
  }

  document.addEventListener('litegraph:contextmenu', handler)
  onScopeDispose(() => {
    document.removeEventListener('litegraph:contextmenu', handler)
    for (const id of idsByMenu.values()) store.close(id)
    idsByMenu.clear()
  })
}
