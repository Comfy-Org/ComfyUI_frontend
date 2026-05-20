import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
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
}

interface ShowPreviewOptions {
  /** If true, blocks new loading operations until the current operation is complete. */
  block?: boolean
}

function createContainer() {
  const container = document.createElement('div')
  container.classList.add('comfy-img-preview')
  return container
}

function createTimeout(ms: number) {
  return new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
}

function useNodePreview<T extends MediaElement>(
  node: LGraphNode,
  options: NodePreviewOptions<T>
) {
  const { loadElement, onLoaded, onFailedLoading } = options
  const nodeOutputStore = useNodeOutputStore()

  async function loadElementWithTimeout(
    url: string,
    retryCount = 0
  ): Promise<T | null> {
    const result = await Promise.race([
      loadElement(url),
      createTimeout(MEDIA_LOAD_TIMEOUT)
    ])

    if (result === null && retryCount < MAX_RETRIES) {
      return loadElementWithTimeout(url, retryCount + 1)
    }

    return result
  }

  async function loadElements(urls: string[]) {
    return Promise.all(urls.map((url) => loadElementWithTimeout(url)))
  }

  /**
   * Displays media element(s) on the node.
   */
  function showPreview(options: ShowPreviewOptions = {}) {
    if (node.isLoading) return

    const outputUrls = nodeOutputStore.getNodeImageUrls(node)
    if (!outputUrls?.length) return

    if (options?.block) node.isLoading = true

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
export function useNodeImage(node: LGraphNode, callback?: () => void) {
  node.previewMediaType = 'image'

  function loadElement(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  function onLoaded(elements: HTMLImageElement[]) {
    node.imageIndex = null
    node.imgs = elements
    callback?.()
  }

  return useNodePreview(node, {
    loadElement,
    onLoaded,
    onFailedLoading: () => {
      node.imgs = undefined
    }
  })
}

/**
 * Attaches a preview video to a node.
 */
export function useNodeVideo(node: LGraphNode, callback?: () => void) {
  node.previewMediaType = 'video'
  let minHeight = DEFAULT_VIDEO_SIZE
  let minWidth = DEFAULT_VIDEO_SIZE

  const { handleWheel, handlePointer } = useCanvasInteractions()

  function setMinDimensions(video: HTMLVideoElement) {
    const { minHeight: calculatedHeight, minWidth: calculatedWidth } =
      fitDimensionsToNodeWidth(
        video.videoWidth,
        video.videoHeight,
        node.size?.[0] || DEFAULT_VIDEO_SIZE
      )

    minWidth = calculatedWidth
    minHeight = calculatedHeight
  }

  function loadElement(url: string): Promise<HTMLVideoElement | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      Object.assign(video, VIDEO_DEFAULT_OPTIONS)

      video.onloadeddata = () => {
        setMinDimensions(video)
        resolve(video)
      }
      video.onerror = () => resolve(null)
      video.src = url
    })
  }

  function addVideoDomWidget(container: HTMLElement) {
    const hasWidget = node.widgets?.some((w) => w.name === VIDEO_WIDGET_NAME)
    if (!hasWidget) {
      const widget = node.addDOMWidget(VIDEO_WIDGET_NAME, 'video', container, {
        canvasOnly: true,
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
      container.addEventListener('pointermove', handlePointer, { signal })
      container.addEventListener('pointerdown', handlePointer, { signal })

      widget.onRemove = useChainCallback(widget.onRemove, () => {
        controller.abort()
      })
    }
  }

  function onLoaded(videoElements: HTMLVideoElement[]) {
    const videoElement = videoElements[0]
    if (!videoElement) return

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
    onFailedLoading: () => {
      node.videoContainer = undefined
    }
  })
}
