import type { Page } from '@playwright/test'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export const addSaveVideo = async (comfyPage: ComfyPage) =>
  (await comfyPage.nodeOps.addNode('SaveVideo', undefined, { x: 300, y: 150 }))
    .id

export const output = (filename: string): NodeExecutionOutput => ({
  images: [{ filename, subfolder: '', type: 'output' }],
  animated: [true]
})

export const canvasVideo = (page: Page) =>
  page.evaluate(() => {
    window.app!.canvas.setDirty(true, true)
    const video = document.querySelector<HTMLVideoElement>(
      '.comfy-img-preview video'
    )
    return (
      video && {
        decoded: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
        portrait: video.videoHeight > video.videoWidth
      }
    )
  })

export const videoPreviewSize = (page: Page, nodeId: NodeId) =>
  page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)!
    const size = node.widgets
      ?.find((w) => w.name === 'video-preview')
      ?.computeLayoutSize?.(node)
    return {
      minWidth: size?.minWidth,
      minHeight: size?.minHeight ?? 0,
      nodeWidth: node.size[0]
    }
  }, nodeId)
