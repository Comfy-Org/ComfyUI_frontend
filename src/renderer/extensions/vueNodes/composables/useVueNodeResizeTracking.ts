import { useDocumentVisibility } from '@vueuse/core'
import {
  effectScope,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'
import type { Ref } from 'vue'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import {
  bindMountedNodeSize,
  mountedGraphScope
} from '@comfyorg/graph-state/layout/mountedNodeSizes'
import { syncSlotOffsets } from '@/renderer/core/layout/slots/syncSlotOffsets'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'

type Measurement = (entry: ResizeObserverEntry) => boolean

function createTracking() {
  const scope = effectScope(true)
  const canvasStore = useCanvasStore()
  const tracked = new Map<Element, Measurement>()
  const deferred = new Set<Element>()
  const observer = scope.run(() => {
    const visibility = useDocumentVisibility()
    const observer = new ResizeObserver((entries) => {
      if (canvasStore.linearMode) return
      let dirty = false
      for (const entry of entries) {
        const report = tracked.get(entry.target)
        if (!report) continue
        if (visibility.value === 'hidden') {
          deferred.add(entry.target)
          observer.unobserve(entry.target)
          continue
        }
        if (report(entry)) dirty = true
      }
      if (dirty) canvasStore.canvas?.setDirty(true, true)
    })
    watch(visibility, (state) => {
      if (state !== 'visible') return
      for (const element of deferred) {
        if (element.isConnected) observer.observe(element)
      }
      deferred.clear()
    })
    return observer
  })!
  return { scope, observer, tracked, deferred }
}

let tracking: ReturnType<typeof createTracking> | undefined

function stopTracking() {
  tracking?.scope.stop()
  tracking?.observer.disconnect()
  tracking?.tracked.clear()
  tracking?.deferred.clear()
  tracking = undefined
}

function track(element: HTMLElement, report: Measurement) {
  const current = (tracking ??= createTracking())
  current.tracked.set(element, report)
  current.observer.observe(element)
  return () => {
    if (current.tracked.get(element) !== report) return
    current.tracked.delete(element)
    current.deferred.delete(element)
    current.observer.unobserve(element)
    if (current.tracked.size === 0) stopTracking()
  }
}

import.meta.hot?.dispose(stopTracking)

export function useMountedNodeSize(
  element: Readonly<Ref<HTMLElement | null>>,
  id: () => string,
  type: () => string | undefined
) {
  const canvasStore = useCanvasStore()
  const rebinding = ref(0)
  watch(
    [
      () => element.value,
      id,
      type,
      () => canvasStore.currentGraph?.rootGraph,
      () =>
        canvasStore.currentGraph && mountedGraphScope(canvasStore.currentGraph),
      () => canvasStore.canvas,
      rebinding
    ],
    ([element, id, , , , canvas], _, onCleanup) => {
      const graph = canvasStore.currentGraph
      if (!element || !graph || !canvas) return
      const nodeId = toNodeId(id)
      const binding = bindMountedNodeSize(graph, nodeId, () => {
        stop()
        rebinding.value++
      })
      const stop = track(element, (entry) => {
        const [box] = entry.borderBoxSize
        const width = box.inlineSize
        const height = box.blockSize
        if (
          !binding.report(
            { width, height: removeNodeTitleHeight(height) },
            element.dataset.collapsed !== undefined
          )
        )
          return false
        element.dataset.measured = ''
        syncSlotOffsets(element, graph.rootGraph.id, nodeId)
        return true
      })
      onCleanup(() => {
        stop()
        binding.dispose()
        delete element.dataset.measured
      })
    },
    { flush: 'post' }
  )
}

export function useWidgetGridResizeTracking(id: string) {
  const canvasStore = useCanvasStore()
  let stop: (() => void) | undefined
  onMounted(() => {
    const element = getCurrentInstance()?.proxy?.$el
    if (!(element instanceof HTMLElement) || !id) return
    stop = track(element, () => {
      const { rootGraphId } = canvasStore
      if (rootGraphId) syncSlotOffsets(element, rootGraphId, toNodeId(id))
      return false
    })
  })
  onUnmounted(() => stop?.())
}
