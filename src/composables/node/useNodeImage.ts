import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useTelemetry } from '@/platform/telemetry'
import { describeImageLoadFailure } from '@/platform/telemetry/imageFailureDiagnostics'
import type { ImageLoadFailureMetadata } from '@/platform/telemetry/types'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { fitDimensionsToNodeWidth } from '@/utils/imageUtil'

const VIDEO_WIDGET_NAME = 'video-preview'
const VIDEO_DEFAULT_OPTIONS = {
  playsInline: true,
  controls: true,
  loop: true
} as const
const MEDIA_LOAD_TIMEOUT = 8192
const MAX_RETRIES = 1
const DEFAULT_VIDEO_SIZE = 256

type MediaElement = HTMLImageElement | HTMLVideoElement

interface NodePreviewOptions<T extends MediaElement> {
  loadElement: (url: string) => Promise<T | null>
  onLoaded?: (elements: T[]) => void
  onFailedLoading?: () => void
  /** Which canvas surface this is, so the failure can be attributed. */
  telemetrySource: Extract<
    ImageLoadFailureMetadata['source'],
    'canvas_node_image' | 'canvas_node_video'
  >
}

interface ShowPreviewOptions {
  /** If true, blocks new loading operations until the current operation is complete. */
  block?: boolean
}

const createContainer = () => {
  const container = document.createElement('div')
  container.classList.add('comfy-img-preview')
  return container
}

const createTimeout = (ms: number) =>
  new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))

/** Distinguishes "the load stalled" from "the load was rejected"; both otherwise yield `null`. */
const MEDIA_LOAD_TIMED_OUT = Symbol('media-load-timed-out')

const useNodePreview = <T extends MediaElement>(
  node: LGraphNode,
  options: NodePreviewOptions<T>
) => {
  const { loadElement, onLoaded, onFailedLoading, telemetrySource } = options
  const nodeOutputStore = useNodeOutputStore()

  const loadElementWithTimeout = async (
    url: string,
    retryCount = 0
  ): Promise<T | null> => {
    // A stalled load and a rejected one both arrive here as `null`, so the
    // timeout resolves a sentinel instead: a 401 and an 8s hang are different
    // problems and must not collapse into the same event. The sentinel is
    // compared rather than a flag set from the timeout's callback — that flag
    // would record "the timeout eventually fired", which is true even when the
    // load lost the race by milliseconds.
    const raced = await Promise.race([
      loadElement(url),
      createTimeout(MEDIA_LOAD_TIMEOUT).then(() => MEDIA_LOAD_TIMED_OUT)
    ])
    const timedOut = raced === MEDIA_LOAD_TIMED_OUT
    const result: T | null = timedOut ? null : (raced as T | null)

    if (result === null && retryCount < MAX_RETRIES) {
      return loadElementWithTimeout(url, retryCount + 1)
    }

    if (result === null) {
      // Reported once per URL, after retries are spent — a report per attempt
      // would inflate the count by exactly `MAX_RETRIES + 1`.
      void describeImageLoadFailure(url).then((diagnostics) => {
        useTelemetry()?.trackImageLoadFailed({
          ...diagnostics,
          source: telemetrySource,
          attempts: retryCount + 1,
          timed_out: timedOut
        })
      })
    }

    return result
  }

  const loadElements = async (urls: string[]) =>
    Promise.all(urls.map((url) => loadElementWithTimeout(url)))

  /**
   * Displays media element(s) on the node.
   */
  function showPreview(options: ShowPreviewOptions = {}) {
    if (node.isLoading) return

    const outputUrls = nodeOutputStore.getNodeImageUrls(node)
    if (!outputUrls?.length) return

    if (options.block) node.isLoading = true

    loadElements(outputUrls)
      .then((elements) => {
        const validElements = elements.filter(
          (el): el is NonNullable<Awaited<T>> => el !== null
        )
        if (validElements.length) {
          onLoaded?.(validElements)
          node.graph?.setDirtyCanvas(true)
        }
      })
      .catch(() => {
        onFailedLoading?.()
      })
      .finally(() => {
        node.isLoading = false
      })
  }

  return {
    showPreview
  }
}

/**
 * Attaches a preview image to a node.
 */
export const useNodeImage = (node: LGraphNode, callback?: () => void) => {
  node.previewMediaType = 'image'

  const loadElement = (url: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })

  const onLoaded = (elements: HTMLImageElement[]) => {
    node.imageIndex = null
    node.imgs = elements
    callback?.()
  }

  return useNodePreview(node, {
    loadElement,
    onLoaded,
    telemetrySource: 'canvas_node_image',
    onFailedLoading: () => {
      node.imgs = undefined
    }
  })
}

/**
 * Attaches a preview video to a node.
 */
export const useNodeVideo = (node: LGraphNode, callback?: () => void) => {
  node.previewMediaType = 'video'
  let minHeight = DEFAULT_VIDEO_SIZE
  let minWidth = DEFAULT_VIDEO_SIZE

  const { handleWheel, handlePointerDown, handlePointerMove } =
    useCanvasInteractions()

  const setMinDimensions = (video: HTMLVideoElement) => {
    const { minHeight: calculatedHeight, minWidth: calculatedWidth } =
      fitDimensionsToNodeWidth(
        video.videoWidth,
        video.videoHeight,
        node.size[0] || DEFAULT_VIDEO_SIZE
      )

    minWidth = calculatedWidth
    minHeight = calculatedHeight
  }

  const loadElement = (url: string): Promise<HTMLVideoElement | null> =>
    new Promise((resolve) => {
      const video = document.createElement('video')
      Object.assign(video, VIDEO_DEFAULT_OPTIONS)

      video.onloadeddata = () => {
        setMinDimensions(video)
        resolve(video)
      }
      video.onerror = () => resolve(null)
      video.src = url
    })

  const addVideoDomWidget = (container: HTMLElement) => {
    const hasWidget = node.widgets?.some((w) => w.name === VIDEO_WIDGET_NAME)
    if (!hasWidget) {
      const widget = node.addDOMWidget(VIDEO_WIDGET_NAME, 'video', container, {
        surfaces: { canvas: 'shown', vueNode: 'never', panel: 'never' },
        hideOnZoom: false
      })
      widget.serialize = false
      widget.computeLayoutSize = () => ({
        minHeight,
        minWidth
      })

      const controller = new AbortController()
      const { signal } = controller
      container.addEventListener('wheel', handleWheel, { signal })
      container.addEventListener('pointermove', handlePointerMove, { signal })
      container.addEventListener('pointerdown', handlePointerDown, { signal })

      widget.onRemove = useChainCallback(widget.onRemove, () => {
        controller.abort()
      })
    }
  }

  const onLoaded = (videoElements: HTMLVideoElement[]) => {
    const videoElement = videoElements[0]

    if (!node.videoContainer) {
      node.videoContainer = createContainer()
      addVideoDomWidget(node.videoContainer)
    }

    node.videoContainer.replaceChildren(videoElement)
    callback?.()
  }

  return useNodePreview(node, {
    loadElement,
    onLoaded,
    telemetrySource: 'canvas_node_video',
    onFailedLoading: () => {
      node.videoContainer = undefined
    }
  })
}
