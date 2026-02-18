import type { Locator, Page, TestInfo } from '@playwright/test'

import type { Position } from '../types'

export interface DebugScreenshotOptions {
  fullPage?: boolean
  element?: 'canvas' | 'page'
  markers?: Array<{ position: Position; id?: string }>
}

export class DebugHelper {
  constructor(
    private page: Page,
    private canvas: Locator
  ) {}

  async addMarker(
    position: Position,
    id: string = 'debug-marker'
  ): Promise<void> {
    await this.page.evaluate(
      ([pos, markerId]) => {
        const existing = document.getElementById(markerId)
        if (existing) existing.remove()

        const marker = document.createElement('div')
        marker.id = markerId
        marker.style.position = 'fixed'
        marker.style.left = `${pos.x - 10}px`
        marker.style.top = `${pos.y - 10}px`
        marker.style.width = '20px'
        marker.style.height = '20px'
        marker.style.border = '2px solid red'
        marker.style.borderRadius = '50%'
        marker.style.backgroundColor = 'rgba(255, 0, 0, 0.3)'
        marker.style.pointerEvents = 'none'
        marker.style.zIndex = '10000'
        document.body.appendChild(marker)
      },
      [position, id] as const
    )
  }

  async removeMarkers(): Promise<void> {
    await this.page.evaluate(() => {
      document
        .querySelectorAll('[id^="debug-marker"]')
        .forEach((el) => el.remove())
    })
  }

  async attachScreenshot(
    testInfo: TestInfo,
    name: string,
    options?: DebugScreenshotOptions
  ): Promise<void> {
    if (options?.markers) {
      for (const marker of options.markers) {
        await this.addMarker(marker.position, marker.id)
      }
    }

    let screenshot: Buffer
    const targetElement = options?.element || 'page'

    if (targetElement === 'canvas') {
      screenshot = await this.canvas.screenshot()
    } else if (options?.fullPage) {
      screenshot = await this.page.screenshot({ fullPage: true })
    } else {
      screenshot = await this.page.screenshot()
    }

    await testInfo.attach(name, {
      body: screenshot,
      contentType: 'image/png'
    })

    if (options?.markers) {
      await this.removeMarkers()
    }
  }

  async saveCanvasScreenshot(filename: string): Promise<void> {
    await this.page.evaluate(async (filename) => {
      const canvas = document.getElementById(
        'graph-canvas'
      ) as HTMLCanvasElement
      if (!canvas) {
        throw new Error('Canvas not found')
      }

      return new Promise<void>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            throw new Error('Failed to create blob from canvas')
          }

          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          resolve()
        }, 'image/png')
      })
    }, filename)
  }

  async getCanvasDataURL(): Promise<string> {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById(
        'graph-canvas'
      ) as HTMLCanvasElement
      if (!canvas) {
        throw new Error('Canvas not found')
      }
      return canvas.toDataURL('image/png')
    })
  }

  async showCanvasOverlay(): Promise<void> {
    await this.page.evaluate(() => {
      const canvas = document.getElementById(
        'graph-canvas'
      ) as HTMLCanvasElement
      if (!canvas) {
        throw new Error('Canvas not found')
      }

      const existingOverlay = document.getElementById('debug-canvas-overlay')
      if (existingOverlay) {
        existingOverlay.remove()
      }

      const overlay = document.createElement('div')
      overlay.id = 'debug-canvas-overlay'
      overlay.style.position = 'fixed'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.zIndex = '9999'
      overlay.style.backgroundColor = 'white'
      overlay.style.padding = '10px'
      overlay.style.border = '2px solid red'

      const img = document.createElement('img')
      img.src = canvas.toDataURL('image/png')
      img.style.maxWidth = '800px'
      img.style.maxHeight = '600px'
      overlay.appendChild(img)

      document.body.appendChild(overlay)
    })
  }

  async hideCanvasOverlay(): Promise<void> {
    await this.page.evaluate(() => {
      const overlay = document.getElementById('debug-canvas-overlay')
      if (overlay) {
        overlay.remove()
      }
    })
  }
}
