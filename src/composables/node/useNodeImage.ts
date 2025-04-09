import type { LGraphNode } from '@comfyorg/litegraph'

import { useNodeOutputStore } from '@/stores/imagePreviewStore'

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

const createContainer = () => {
  const container = document.createElement('div')
  container.classList.add('comfy-img-preview')
  return container
}

const createTimeout = (ms: number) =>
  new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))

export const useNodePreview = <T extends MediaElement>(
  node: LGraphNode,
  options: NodePreviewOptions<T>
) => {
  const { loadElement, onLoaded, onFailedLoading } = options
  const nodeOutputStore = useNodeOutputStore()

  const loadElementWithTimeout = async (
    url: string,
    retryCount = 0
  ): Promise<T | null> => {
    const result = await Promise.race([
      loadElement(url),
      createTimeout(MEDIA_LOAD_TIMEOUT)
    ])

    if (result === null && retryCount < MAX_RETRIES) {
      return loadElementWithTimeout(url, retryCount + 1)
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
export const useNodeImage = (node: LGraphNode) => {
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
export const useNodeVideo = (node: LGraphNode) => {
  node.previewMediaType = 'video'
  let minHeight = DEFAULT_VIDEO_SIZE
  let minWidth = DEFAULT_VIDEO_SIZE

  const setMinDimensions = (video: HTMLVideoElement) => {
    const intrinsicAspectRatio = video.videoWidth / video.videoHeight
    if (!intrinsicAspectRatio || isNaN(intrinsicAspectRatio)) return

    // Set min. height s.t. video spans node's x-axis while maintaining aspect ratio
    minWidth = node.size?.[0] || DEFAULT_VIDEO_SIZE
    minHeight = Math.max(minWidth / intrinsicAspectRatio, 64)
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
        hideOnZoom: false
      })
      widget.serialize = false
      widget.computeLayoutSize = () => ({
        minHeight,
        minWidth
      })
    }
  }

  const onLoaded = (videoElements: HTMLVideoElement[]) => {
    const videoElement = videoElements[0]
    if (!videoElement) return

    if (!node.videoContainer) {
      node.videoContainer = createContainer()
      addVideoDomWidget(node.videoContainer)
    }

    node.videoContainer.replaceChildren(videoElement)
  }

  return useNodePreview(node, {
    loadElement,
    onLoaded,
    onFailedLoading: () => {
      node.videoContainer = undefined
    }
  })
}
