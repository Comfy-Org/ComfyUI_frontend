import type { LGraphNode } from '@comfyorg/litegraph'

import { useNodeOutputStore } from '@/stores/imagePreviewStore'

const VIDEO_DEFAULT_OPTIONS = {
  playsInline: true,
  controls: true,
  loop: true
} as const

interface NodePreviewOptions<T> {
  loadElement: (url: string) => Promise<T | null>
  onLoaded?: (elements: T[]) => void
  onFailedLoading?: () => void
}

export const useNodePreview = <T extends HTMLElement>(
  node: LGraphNode,
  options: NodePreviewOptions<T>
) => {
  const { loadElement, onLoaded, onFailedLoading } = options
  const nodeOutputStore = useNodeOutputStore()

  let isLoading = false
  let isFailedLoading = false

  const loadElements = async (urls: string[]) =>
    Promise.all(urls.map(loadElement))

  const render = () => {
    node.setSizeForImage?.()
    node.graph?.setDirtyCanvas(true)
  }

  /**
   * Displays media element(s) on the node.
   * @param output - A filename, path, or array of filenames/paths to display.
   */
  function show(output: string | string[]) {
    if (!output || isLoading || isFailedLoading) return

    isLoading = true
    nodeOutputStore.setNodeOutputs(node, output)
    const outputUrls = nodeOutputStore.getNodeImageUrls(node)

    loadElements(outputUrls)
      .then((elements) => {
        const validElements = elements.filter((el) => el !== null)
        if (!validElements?.length) return

        onLoaded?.(validElements)
        render()
      })
      .catch((err) => {
        isFailedLoading = true
        onFailedLoading?.()
      })
      .finally(() => {
        isLoading = false
      })
  }

  return {
    show
  }
}

/**
 * Attaches a preview image to a node.
 */
export const useNodeImage = (node: LGraphNode) => {
  const nodeOutputStore = useNodeOutputStore()

  const loadElement = (url: string) => {
    return new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
      return img
    })
  }

  const onLoaded = (elements: HTMLImageElement[]) => {
    node.imageIndex = null
    node.images = nodeOutputStore.getNodeOutputs(node)?.images
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
  const container = document.createElement('div')
  container.classList.add('comfy-img-preview')

  let loaded = false

  const loadElement = (url: string) => {
    return new Promise<HTMLVideoElement | null>((resolve) => {
      const video = document.createElement('video')
      Object.assign(video, VIDEO_DEFAULT_OPTIONS)
      video.onloadeddata = () => resolve(video)
      video.onerror = () => resolve(null)
      video.src = url
      return video
    })
  }

  const addVideoDomWidget = () => {
    node.addDOMWidget('video-preview', 'video', container, {
      hideOnZoom: false
    })
  }

  const onLoaded = (videoElements: HTMLVideoElement[]) => {
    const videoElement = videoElements[0]
    if (!videoElement) return

    if (!loaded) {
      addVideoDomWidget()
      container.replaceChildren(videoElement)
      loaded = true
    } else {
      container.appendChild(videoElement)
    }
  }

  return useNodePreview(node, {
    loadElement,
    onLoaded
  })
}
