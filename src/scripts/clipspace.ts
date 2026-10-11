import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import { useApp } from '@/scripts/appInstance'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

export type Clipspace = {
  widgets?: Pick<IBaseWidget, 'type' | 'name' | 'value'>[] | null
  imgs?: HTMLImageElement[] | null
  original_imgs?: HTMLImageElement[] | null
  images?: ResultItem[] | null
  selectedIndex: number
  img_paste_mode: string
  paintedIndex: number
  combinedIndex?: number
}

/**
 * Content clipboard shared by the mask editor and clipspace extensions.
 * `ComfyApp` exposes it as static members for custom-node compatibility.
 */
export const clipspace: {
  current: Clipspace | null
  invalidateHandler: (() => void) | null
  returnNode: LGraphNode | null
  maskEditorIsOpened: (() => boolean) | null
} = {
  current: null,
  invalidateHandler: null,
  returnNode: null,
  maskEditorIsOpened: null
}

export function copyToClipspace(node: LGraphNode) {
  let widgets = null
  if (node.widgets) {
    widgets = node.widgets.map(({ type, name, value }) => ({
      type,
      name,
      value
    }))
  }

  let imgs = undefined
  let orig_imgs = undefined
  if (node.imgs != undefined) {
    imgs = []
    orig_imgs = []

    for (let i = 0; i < node.imgs.length; i++) {
      imgs[i] = new Image()
      imgs[i].src = node.imgs[i].src
      orig_imgs[i] = imgs[i]
    }
  }

  let selectedIndex = 0
  if (node.imageIndex) {
    selectedIndex = node.imageIndex
  }

  const paintedIndex = imgs ? imgs.length + 1 : 1
  const combinedIndex = imgs ? imgs.length + 2 : 2

  // for vueNodes mode
  const images = useNodeOutputStore().getNodeOutputs(node)?.images

  clipspace.current = {
    widgets: widgets,
    imgs: imgs,
    original_imgs: orig_imgs,
    images: images,
    selectedIndex: selectedIndex,
    img_paste_mode: 'selected', // reset to default im_paste_mode state on copy action
    paintedIndex: paintedIndex,
    combinedIndex: combinedIndex
  }

  clipspace.returnNode = null

  if (clipspace.invalidateHandler) {
    clipspace.invalidateHandler()
  }
}

export function pasteFromClipspace(node: LGraphNode) {
  if (clipspace.current) {
    // image paste
    let combinedImgSrc: string | undefined
    if (
      clipspace.current.combinedIndex !== undefined &&
      clipspace.current.imgs &&
      clipspace.current.combinedIndex < clipspace.current.imgs.length
    ) {
      combinedImgSrc =
        clipspace.current.imgs[clipspace.current.combinedIndex].src
    }
    if (clipspace.current.imgs && node.imgs) {
      // Update node.images even if it's initially undefined (vueNodes mode)
      if (clipspace.current.images) {
        const images =
          clipspace.current['img_paste_mode'] == 'selected'
            ? [clipspace.current.images[clipspace.current['selectedIndex']]]
            : clipspace.current.images
        useNodeOutputStore().setNodeOutputImages(node, images)
      }

      // deep-copy to cut link with clipspace
      if (clipspace.current['img_paste_mode'] == 'selected') {
        const img = new Image()
        img.src = clipspace.current.imgs[clipspace.current['selectedIndex']].src
        node.imgs = [img]
        node.imageIndex = 0
      } else {
        const imgs = []
        for (let i = 0; i < clipspace.current.imgs.length; i++) {
          imgs[i] = new Image()
          imgs[i].src = clipspace.current.imgs[i].src
          node.imgs = imgs
        }
      }
    }

    // Paste the RGB canvas if paintedindex exists
    if (clipspace.current.imgs?.[clipspace.current.paintedIndex] && node.imgs) {
      const paintedImg = new Image()
      paintedImg.src =
        clipspace.current.imgs[clipspace.current.paintedIndex].src
      node.imgs.push(paintedImg) // Add the RGB canvas to the node's images
    }

    // Store only combined image inside the node if it exists
    if (node.imgs && combinedImgSrc) {
      const combinedImg = new Image()
      combinedImg.src = combinedImgSrc
      node.imgs = [combinedImg]
    }

    if (node.widgets) {
      if (clipspace.current.images) {
        const clip_image =
          clipspace.current.images[clipspace.current['selectedIndex']]
        const index = node.widgets.findIndex((obj) => obj.name === 'image')
        if (index >= 0) {
          if (
            node.widgets[index].type != 'image' &&
            typeof node.widgets[index].value == 'string' &&
            clip_image.filename
          ) {
            node.widgets[index].value =
              (clip_image.subfolder ? clip_image.subfolder + '/' : '') +
              clip_image.filename +
              (clip_image.type ? ` [${clip_image.type}]` : '')
          } else {
            node.widgets[index].value = clip_image
          }
        }
      }
      if (clipspace.current.widgets) {
        clipspace.current.widgets.forEach(({ type, name, value }) => {
          const prop = node.widgets?.find(
            (obj) => obj.type === type && obj.name === name
          )
          if (prop && prop.type != 'button') {
            const valueObj = value as Record<string, unknown> | undefined
            if (
              prop.type != 'image' &&
              typeof prop.value == 'string' &&
              valueObj?.filename
            ) {
              const resultItem = value as ResultItem
              prop.value =
                (resultItem.subfolder ? resultItem.subfolder + '/' : '') +
                resultItem.filename +
                (resultItem.type ? ` [${resultItem.type}]` : '')
            } else {
              prop.value = value
              prop.callback?.(value)
            }
          }
        })
      }
    }

    useApp().canvas.setDirty(true)
  }
}
