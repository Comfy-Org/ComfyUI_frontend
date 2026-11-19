import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

export class VideoPreview {
  public readonly navigationDots: Locator
  public readonly preview: Locator
  public readonly upload: Locator
  public readonly video: Locator
  public readonly download: Locator

  constructor(loadVideoNode: Locator) {
    this.preview = loadVideoNode.locator('.video-preview')
    this.navigationDots = this.preview.getByRole('button', {
      name: 'View video'
    })
    this.upload = loadVideoNode.locator('input')
    this.video = this.preview.locator('video')
    this.download = loadVideoNode.getByRole('button', {
      name: 'Download video'
    })
  }
  async uploadAndLoad(path: string) {
    await this.upload.setInputFiles(path)
    await expect
      .poll(() =>
        this.video.evaluate((video: HTMLVideoElement) => video.videoWidth)
      )
      .toBeGreaterThan(0)
  }

  async videoSrc() {
    return await this.video.getAttribute('src')
  }
}
