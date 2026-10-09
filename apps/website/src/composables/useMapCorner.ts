import type { MaybeElementRef } from '@vueuse/core'
import { useElementSize, useEventListener } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, inject, ref, toValue, watch } from 'vue'

import { FIT } from '@/components/workshop/app-editor/zoom'
import type { MapCorner } from '@/lib/workshop/relight/map-corner'
import {
  MAP_INSET,
  handleBox,
  pickMapCorner
} from '@/lib/workshop/relight/map-corner'
import { EDITOR_ZOOM } from './useEditorZoom'

/**
 * The light map card's corner of the photo: the first one, top left
 * first, with no light handle under it on screen at the current zoom.
 * It holds still while a pointer is down, so dragging a light past the
 * card does not make it jump, and settles when the drag ends.
 */
export function useMapCorner(
  photo: MaybeElementRef,
  card: MaybeElementRef,
  handles: MaybeRefOrGetter<readonly { x: number; y: number }[]>
) {
  const zoom = inject(EDITOR_ZOOM, undefined)
  const frame = useElementSize(photo)
  const size = useElementSize(card, undefined, { box: 'border-box' })
  const wanted = computed(() => {
    const photoSize = { width: frame.width.value, height: frame.height.value }
    const view = zoom?.view.value ?? FIT
    return pickMapCorner(
      photoSize,
      { width: size.width.value, height: size.height.value },
      toValue(handles).map((at) => handleBox(at, photoSize, view))
    )
  })

  const held = ref(false)
  const hold = (down: boolean) => () => (held.value = down)
  useEventListener(window, 'pointerdown', hold(true), { capture: true })
  useEventListener(window, ['pointerup', 'pointercancel'], hold(false), {
    capture: true
  })

  const corner = ref<MapCorner>('top-left')
  watch(
    [wanted, held],
    () => {
      if (!held.value) corner.value = wanted.value
    },
    { immediate: true }
  )

  const style = computed(() => {
    const right = corner.value.endsWith('right')
    const bottom = corner.value.startsWith('bottom')
    return {
      left: right ? `calc(100% - ${MAP_INSET.edge}px)` : `${MAP_INSET.edge}px`,
      top: bottom
        ? `calc(100% - ${MAP_INSET.bottom}px)`
        : `${MAP_INSET.edge}px`,
      translate: `${right ? '-100%' : '0'} ${bottom ? '-100%' : '0'}`
    }
  })

  return { corner, style }
}
