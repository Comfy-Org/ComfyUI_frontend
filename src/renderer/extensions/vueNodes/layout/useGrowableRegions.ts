import { useEventListener } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import type { ComputedRef, InjectionKey } from 'vue'

import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import { useWidgetHeightStore } from '@/stores/widgetHeightStore'

const USER_HEIGHT_PROBE = '--user-height-probe'
const NODE_FLOOR = ['--node-height']
const REGION_FLOOR = ['--node-height', USER_HEIGHT_PROBE]

interface GrowableRegions {
  heightOf: (name: string) => number | undefined
  handle: ComputedRef<
    ReturnType<typeof useGrowableRegions>['handle'] | undefined
  >
}

export const growableRegionsKey: InjectionKey<GrowableRegions> =
  Symbol('growableRegions')

/** A grid track at the user's height that collapses to its content minimum only while a region measures its floor. */
export function userHeightTrack(height: number): string {
  return `minmax(min-content, min(var(${USER_HEIGHT_PROBE}, ${height}px), ${height}px))`
}

function withCollapsedHeights<T>(
  nodeElement: HTMLElement,
  properties: readonly string[],
  read: () => T
): T {
  const saved = properties.map((property) =>
    nodeElement.style.getPropertyValue(property)
  )
  for (const property of properties)
    nodeElement.style.setProperty(property, '0px')
  const result = read()
  properties.forEach((property, index) =>
    nodeElement.style.setProperty(property, saved[index])
  )
  return result
}

function soleMediaAspectRatio(region: HTMLElement) {
  const media = region.querySelectorAll<HTMLImageElement | HTMLVideoElement>(
    'img, video'
  )
  if (media.length !== 1) return undefined
  const [element] = media
  const [width, height] =
    element instanceof HTMLVideoElement
      ? [element.videoWidth, element.videoHeight]
      : [element.naturalWidth, element.naturalHeight]
  return width && height ? { element, aspectRatio: width / height } : undefined
}

function closestNodeElement(event: Event) {
  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) return undefined
  const nodeElement = handle.closest<HTMLElement>('[data-node-id]')
  return nodeElement ? { handle, nodeElement } : undefined
}

function regionAt(event: Event, key: string) {
  const target = closestNodeElement(event)
  const region = target?.handle.parentElement
  return target && region ? { ...target, region, key } : undefined
}

/** Sizes a Vue node's growable regions, each named by its widget or preview and holding the user's height in {@link useWidgetHeightStore}. */
export function useGrowableRegions({
  regionId,
  resizeNode,
  onCommit
}: {
  regionId: (name: string) => WidgetId | undefined
  resizeNode: (height: number, width?: number) => void
  onCommit: () => void
}) {
  const transformState = useTransformState()
  const heightStore = useWidgetHeightStore()

  function heightOf(name: string) {
    const id = regionId(name)
    return id ? heightStore.getHeight(id) : undefined
  }

  function setHeight(name: string, height: number | undefined) {
    const id = regionId(name)
    if (id) heightStore.setHeight(id, height)
  }

  function fitNode(event: MouseEvent) {
    const target = closestNodeElement(event)
    if (!target) return
    resizeNode(
      withCollapsedHeights(
        target.nodeElement,
        NODE_FLOOR,
        () => target.nodeElement.offsetHeight
      )
    )
    onCommit()
  }

  function start(event: PointerEvent, name: string, maxHeight = Infinity) {
    if (event.button !== 0) return
    const target = regionAt(event, name)
    if (!target) return
    const { handle, nodeElement, region, key } = target

    const startHeight = region.offsetHeight
    const minHeight = withCollapsedHeights(
      nodeElement,
      REGION_FLOOR,
      () => region.offsetHeight
    )
    const startNodeHeight = nodeElement.offsetHeight
    const startY = event.clientY

    handle.setPointerCapture(event.pointerId)
    const stopMove = useEventListener(handle, 'pointermove', (move) => {
      const deltaY = (move.clientY - startY) / (transformState.camera.z || 1)
      const height = clamp(startHeight + deltaY, minHeight, maxHeight)
      setHeight(key, height)
      resizeNode(startNodeHeight + height - startHeight)
    })
    const stopRelease = useEventListener(handle, 'lostpointercapture', () => {
      stopMove()
      stopRelease()
    })
  }

  function fitMedia(
    { nodeElement, region, key }: NonNullable<ReturnType<typeof regionAt>>,
    { element, aspectRatio }: { element: HTMLElement; aspectRatio: number }
  ) {
    const minMediaHeight = withCollapsedHeights(
      nodeElement,
      REGION_FLOOR,
      () => element.offsetHeight
    )
    const mediaHeight = Math.max(
      element.offsetWidth / aspectRatio,
      minMediaHeight
    )
    const regionGrowth = mediaHeight - element.offsetHeight
    setHeight(key, region.offsetHeight + regionGrowth)
    resizeNode(
      nodeElement.offsetHeight + regionGrowth,
      nodeElement.offsetWidth + mediaHeight * aspectRatio - element.offsetWidth
    )
  }

  function reset(event: MouseEvent, name: string) {
    const target = regionAt(event, name)
    if (!target) return
    const media = soleMediaAspectRatio(target.region)
    if (media) fitMedia(target, media)
    else setHeight(target.key, undefined)
    onCommit()
  }

  return { heightOf, fitNode, handle: { start, reset } }
}
