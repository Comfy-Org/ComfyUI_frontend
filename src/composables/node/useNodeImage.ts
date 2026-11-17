import { useChainCallback } from '@/composables/functional/useChainCallback'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useTelemetry } from '@comfyorg/telemetry'
import { describeImageLoadFailure } from '@/platform/telemetry/imageFailureDiagnostics'
import type { ImageLoadFailureMetadata } from '@comfyorg/telemetry/types'
import { VIDEO_PREVIEW_WIDGET } from '@/core/graph/subgraph/preview/mediaPreviewName'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { fitDimensionsToNodeWidth } from '@/utils/imageUtil'
import type { MediaSources } from '@/utils/mediaResource'

const VIDEO_DEFAULT_OPTIONS = {
  playsInline: true,
  controls: true,
  loop: true
} as const
const MEDIA_LOAD_TIMEOUT = 8192
const MAX_RETRIES = 1
const DEFAULT_VIDEO_SIZE = 256
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4

/** Message for a failed video load, from the media error codes of its attempts. */
export function videoFailureMessageKey(errorCodes: (number | undefined)[]) {
  return errorCodes.includes(MEDIA_ERR_SRC_NOT_SUPPORTED)
    ? 'g.videoFormatNotSupported'
    : 'g.videoFailedToLoad'
}

type MediaElement = HTMLImageElement | HTMLVideoElement

interface NodePreviewOptions<T extends MediaElement> {
  loadElement: (url: string, originalUrl: string) => Promise<T | null>
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
    source: Pick<MediaSources, 'originalUrl' | 'previewUrl'>,
    retryCount = 0
  ): Promise<T | null> => {
    const url = source.previewUrl
    if (!url) return null
    const raced = await Promise.race([
      loadElement(url, source.originalUrl),
      createTimeout(MEDIA_LOAD_TIMEOUT).then(() => MEDIA_LOAD_TIMED_OUT)
    ])
    const timedOut = raced === MEDIA_LOAD_TIMED_OUT
    const result: T | null = timedOut ? null : (raced as T | null)

    if (result === null && retryCount < MAX_RETRIES) {
      return loadElementWithTimeout(source, retryCount + 1)
    }

    if (result === null) {
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

  const loadElements = async (
    sources: Pick<MediaSources, 'originalUrl' | 'previewUrl'>[]
  ) => Promise.all(sources.map((source) => loadElementWithTimeout(source)))

  /**
   * Displays media element(s) on the node.
   */
  function showPreview(options: ShowPreviewOptions = {}) {
    if (node.isLoading) return

    const sources = nodeOutputStore.getNodeImageSources(node)
    if (!sources.length) return

    if (options.block) node.isLoading = true
    const { images, preview } = node

    loadElements(sources)
      .then((elements) => {
        if (node.images !== images || node.preview !== preview) return
        const validElements = elements.filter(
          (el): el is NonNullable<Awaited<T>> => el !== null
        )
        if (validElements.length) {
          onLoaded?.(validElements)
        } else {
          onFailedLoading?.()
        }
        node.graph?.setDirtyCanvas(true)
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

  const loadElement = (
    url: string,
    originalUrl: string
  ): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      if (originalUrl !== url) img.dataset.fileUrl = originalUrl
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
      callback?.()
    }
  })
}

/**
 * Attaches a preview video to a node.
 */
export const useNodeVideo = (node: LGraphNode, callback?: () => void) => {
  node.previewMediaType = 'video'
  let minHeight = DEFAULT_VIDEO_SIZE
  let minWidth = 0
  let errorCodes: (number | undefined)[] = []

  const { handleWheel, handlePointerDown, handlePointerMove } =
    useCanvasInteractions()

  const findVideoWidget = () =>
    node.widgets?.find((w) => w.name === VIDEO_PREVIEW_WIDGET)

  const setMinDimensions = (video: HTMLVideoElement) => {
    const shownWidth = findVideoWidget()?.computeLayoutSize?.(node).minWidth
    const { minHeight: calculatedHeight, minWidth: calculatedWidth } =
      fitDimensionsToNodeWidth(
        video.videoWidth,
        video.videoHeight,
        shownWidth || node.size[0] || DEFAULT_VIDEO_SIZE
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
      video.onerror = () => {
        errorCodes.push(video.error?.code)
        resolve(null)
      }
      video.src = url
    })

  const addVideoDomWidget = (container: HTMLElement) => {
    const hasWidget = node.widgets?.some((w) => w.name === VIDEO_PREVIEW_WIDGET)
    if (!hasWidget) {
      const widget = node.addDOMWidget(
        VIDEO_PREVIEW_WIDGET,
        'video',
        container,
        {
          surfaces: { canvas: 'shown', vueNode: 'never', panel: 'never' },
          hideOnZoom: false
        }
      )
      widget.serialize = false
      widget.computeLayoutSize = () => ({ minHeight, minWidth })

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

  const showInContainer = (element: HTMLElement) => {
    if (!node.videoContainer) {
      node.videoContainer = createContainer()
      addVideoDomWidget(node.videoContainer)
    }
    node.videoContainer.replaceChildren(element)
  }

  const onLoaded = (videoElements: HTMLVideoElement[]) => {
    showInContainer(videoElements[0])
    const widget = findVideoWidget()
    if (widget) widget.computeLayoutSize = () => ({ minHeight, minWidth })
    errorCodes = []
    callback?.()
  }

  return useNodePreview(node, {
    loadElement,
    onLoaded,
    telemetrySource: 'canvas_node_video',
    onFailedLoading: () => {
      const message = document.createElement('p')
      message.className = 'p-2 text-center text-sm'
      message.textContent = t(videoFailureMessageKey(errorCodes))
      errorCodes = []
      showInContainer(message)
      callback?.()
    }
  })
}
