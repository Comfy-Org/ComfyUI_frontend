import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyFiles, ComfyPage } from '@e2e/fixtures/ComfyPage'

export const LOAD_VIDEO = 'VHS_LoadVideo'

export const UPLOAD_BUTTON = 'choose video to upload'

const VIDEO_ASSET = resolve('browser_tests/assets/plain_video.mp4')

export function videoUploadPayload(comfyFiles: ComfyFiles) {
  const name = `${randomUUID()}-plain_video.mp4`
  comfyFiles.deleteAfterTest({ filename: name, type: 'input' })
  return { name, mimeType: 'video/mp4', buffer: readFileSync(VIDEO_ASSET) }
}

export async function videoWidgetValue(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate(
    (id) =>
      window
        .app!.graph.getNodeById(id)!
        .widgets!.find((w) => w.name === 'video')!.value,
    nodeId
  )
}

export function previewVideo(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.locator(
    comfyPage.isVueNodes
      ? `[data-node-id="${nodeId}"] .vhs_preview video`
      : '.vhs_preview video'
  )
}

export async function loadVideoIntoNode(
  comfyPage: ComfyPage,
  comfyFiles: ComfyFiles,
  nodeId: NodeId
) {
  const image = videoUploadPayload(comfyFiles)
  const filename = image.name
  const response = await comfyPage.request.post(
    `${comfyPage.url}/api/upload/image`,
    {
      multipart: {
        image,
        overwrite: 'true',
        type: 'input'
      }
    }
  )
  expect(response.ok(), 'video upload').toBe(true)
  await comfyPage.page.evaluate(
    ({ id, filename }) => {
      const widget = window
        .app!.graph.getNodeById(id)!
        .widgets!.find((w) => w.name === 'video')!
      widget.value = filename
      widget.callback?.(filename)
    },
    { id: nodeId, filename }
  )
  await expect
    .poll(() =>
      previewVideo(comfyPage, nodeId).evaluate(
        (video: HTMLVideoElement) => video.videoWidth
      )
    )
    .toBe(128)
}
