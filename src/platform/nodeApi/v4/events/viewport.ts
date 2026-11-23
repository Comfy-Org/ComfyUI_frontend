import { watch } from 'vue'

import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import type { CanvasSource } from '@/platform/nodeApi/shared/canvasSource'
import type { Unsubscribe } from '@/platform/nodeApi/v4/types'

type ViewChangeHandler = NonNullable<DragAndScale['onChanged']>

export function createViewportEvents(
  source: () => CanvasSource | undefined
): (listener: () => void) => Unsubscribe {
  return createHostEvent('onViewportChanged', (emit) => {
    let unchain: (() => void) | undefined
    const stopWatching = watch(
      () => source()?.canvas()?.ds,
      (ds) => {
        unchain?.()
        unchain = ds && chainOnto(ds, emit)
      },
      { immediate: true, flush: 'sync' }
    )
    return () => {
      stopWatching()
      unchain?.()
    }
  })
}

function chainOnto(ds: DragAndScale, emit: () => void): () => void {
  const previous = ds.onChanged
  let chained = true
  const handler: ViewChangeHandler = (scale, offset) => {
    previous?.call(ds, scale, offset)
    if (chained) emit()
  }
  ds.onChanged = handler
  return () => {
    chained = false
    if (ds.onChanged === handler) ds.onChanged = previous
  }
}
