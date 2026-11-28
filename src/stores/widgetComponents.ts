import { useWidgetFolderLockStore } from './widgetFolderLockStore'
import { useWidgetHeightStore } from './widgetHeightStore'

export const widgetComponentStores = [
  useWidgetFolderLockStore,
  useWidgetHeightStore
]

export function useWidgetComponents() {
  const stores = widgetComponentStores.map((useStore) => useStore())

  function prepareNode(
    properties: Parameters<(typeof stores)[number]['adoptNode']>[2],
    incoming: Parameters<(typeof stores)[number]['adoptNode']>[2]
  ) {
    for (const { wireKey } of stores) {
      if (!Object.hasOwn(incoming, wireKey)) delete properties[wireKey]
    }
  }

  function adoptNode(
    ...args: Parameters<(typeof stores)[number]['adoptNode']>
  ) {
    for (const store of stores) store.adoptNode(...args)
  }

  function writeNode(
    ...args: Parameters<(typeof stores)[number]['writeNode']>
  ) {
    for (const store of stores) store.writeNode(...args)
  }

  function detachNode(
    ...args: Parameters<(typeof stores)[number]['writeNode']>
  ) {
    const [graphId, nodeId, properties] = args
    const saved = {}
    writeNode(graphId, nodeId, saved)
    Object.assign(properties, saved)
  }

  function remove(id: Parameters<(typeof stores)[number]['set']>[0]) {
    for (const store of stores) store.set(id, undefined)
  }

  function keep(id: Parameters<(typeof stores)[number]['get']>[0]) {
    const restores = stores.map((store) => store.keep(id))
    return () => restores.forEach((restore) => restore())
  }

  function move(...args: Parameters<(typeof stores)[number]['move']>) {
    for (const store of stores) store.move(...args)
  }

  function clearNode(
    ...args: Parameters<(typeof stores)[number]['clearNode']>
  ) {
    for (const store of stores) store.clearNode(...args)
  }

  function clearGraph(
    ...args: Parameters<(typeof stores)[number]['clearGraph']>
  ) {
    for (const store of stores) store.clearGraph(...args)
  }

  return {
    prepareNode,
    adoptNode,
    writeNode,
    detachNode,
    remove,
    keep,
    move,
    clearNode,
    clearGraph
  }
}
