import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { CameraWidget } from '../components/hero/camera/CameraWidget'
import type { CameraPalette } from '../components/hero/camera/types'

/** The three numbers a camera pose is, each held by whoever owns the form. */
export interface CameraPose {
  azimuth: Ref<number>
  elevation: Ref<number>
  zoom: Ref<number>
}

/**
 * The 3D pose widget, mounted into a container and kept in step with the three
 * numbers it stands for.
 *
 * It costs a WebGL scene, so it is built only once the container comes into
 * view and it stops drawing whenever it leaves again or the tab is hidden.
 * The hero and the run panel both show the same camera; only their colours and
 * the picture on the card differ.
 */
export function useCameraWidget(
  container: Ref<HTMLElement | undefined>,
  pose: CameraPose,
  look: { palette: Partial<CameraPalette>; image: () => string | null }
) {
  const ready = ref(false)

  let widget: CameraWidget | null = null
  const gone = ref(false)
  let fromWidget = false
  let intersecting = true
  let initObserver: IntersectionObserver | null = null
  let pauseObserver: IntersectionObserver | null = null

  function syncPause() {
    if (!widget) return
    if (document.hidden || !intersecting) widget.pause()
    else widget.resume()
  }

  async function build(host: HTMLElement) {
    await new Promise<void>((resolve) => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => resolve())
      else setTimeout(resolve, 200)
    })
    if (gone.value || widget) return

    const { CameraWidget: Widget } =
      await import('../components/hero/camera/CameraWidget')
    // Loading the scene takes a moment, and the page may have moved on: a
    // container that has left the document has nothing to mount into.
    if (!host.isConnected) return

    widget = new Widget({
      container: host,
      palette: look.palette,
      initialState: {
        azimuth: pose.azimuth.value,
        elevation: pose.elevation.value,
        distance: pose.zoom.value,
        imageUrl: look.image()
      },
      onStateChange: (state) => {
        fromWidget = true
        pose.azimuth.value = state.azimuth
        pose.elevation.value = state.elevation
        pose.zoom.value = state.distance
        fromWidget = false
      }
    })
    ready.value = true

    pauseObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting
      syncPause()
    })
    pauseObserver.observe(host)
    document.addEventListener('visibilitychange', syncPause)
  }

  watch(
    [pose.azimuth, pose.elevation, pose.zoom],
    ([azimuth, elevation, zoom]) => {
      if (fromWidget || !widget) return
      widget.setState({ azimuth, elevation, distance: zoom })
    },
    { flush: 'sync' }
  )

  watch(
    () => look.image(),
    (imageUrl) => widget?.setState({ imageUrl })
  )

  onMounted(() => {
    const host = container.value
    if (!host) return
    initObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        initObserver?.disconnect()
        initObserver = null
        void build(host)
      },
      { rootMargin: '100px' }
    )
    initObserver.observe(host)
  })

  onUnmounted(() => {
    gone.value = true
    initObserver?.disconnect()
    pauseObserver?.disconnect()
    document.removeEventListener('visibilitychange', syncPause)
    widget?.dispose()
    widget = null
  })

  return { ready }
}
