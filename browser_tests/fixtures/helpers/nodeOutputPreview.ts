import type { Page } from '@playwright/test'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export const PLAYABLE = 'video-preview-square.webm'
export const WIDE = 'video-preview-wide.webm'
export const PORTRAIT = 'video-preview-portrait.webm'
export const UNDECODABLE = 'save-video-prores.mov'
export const SLOW = 'slow.webm'
export const IMAGE = 'ok.png'
export const CANT_PLAY_MESSAGE = "This video can't be played in the browser."

export async function addNode(comfyPage: ComfyPage, type: string) {
  const node = await comfyPage.nodeOps.addNode(type, undefined, {
    x: 300,
    y: 150
  })
  return node.id
}

export const filenameOf = (url: string | URL) =>
  new URL(url).searchParams.get('filename')

export const waitForServed = (page: Page, filename: string) =>
  page.waitForResponse(
    (response) => response.ok() && filenameOf(response.url()) === filename
  )

export const output = (
  filename: string,
  animated = true
): NodeExecutionOutput => ({
  images: [{ filename, subfolder: '', type: 'output' }],
  animated: [animated]
})

export function canvasPreviewVideo(page: Page) {
  return page.evaluate(() => {
    window.app!.canvas.setDirty(true, true)
    const video = document.querySelector<HTMLVideoElement>(
      '.comfy-img-preview video'
    )
    if (!video) return null
    return {
      file: new URL(video.src).searchParams.get('filename'),
      decoded: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    }
  })
}
