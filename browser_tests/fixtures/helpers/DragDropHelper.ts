import { readFileSync } from 'fs'

import type { Page } from '@playwright/test'

import type { Position } from '../types'
import { getMimeType } from './mimeTypeUtil'

export class DragDropHelper {
  constructor(
    private readonly page: Page,
    private readonly assetPath: (fileName: string) => string
  ) {}

  private async nextFrame(): Promise<void> {
    await this.page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })
  }

  async dragAndDropExternalResource(
    options: {
      fileName?: string
      url?: string
      dropPosition?: Position
      waitForUpload?: boolean
      preserveNativePropagation?: boolean
    } = {}
  ): Promise<void> {
    const {
      dropPosition = { x: 100, y: 100 },
      fileName,
      url,
      waitForUpload = false,
      preserveNativePropagation = false
    } = options

    if (!fileName && !url)
      throw new Error('Must provide either fileName or url')

    const evaluateParams: {
      dropPosition: Position
      fileName?: string
      fileType?: string
      buffer?: Uint8Array | number[]
      url?: string
      preserveNativePropagation: boolean
    } = { dropPosition, preserveNativePropagation }

    if (fileName) {
      const filePath = this.assetPath(fileName)
      const buffer = readFileSync(filePath)

      evaluateParams.fileName = fileName
      evaluateParams.fileType = getMimeType(fileName)
      evaluateParams.buffer = [...new Uint8Array(buffer)]
    }

    if (url) evaluateParams.url = url

    const uploadResponsePromise = waitForUpload
      ? this.page.waitForResponse(
          (resp) => resp.url().includes('/upload/') && resp.status() === 200,
          { timeout: 10000 }
        )
      : null

    await this.page.evaluate(async (params) => {
      const dataTransfer = new DataTransfer()

      if (params.buffer && params.fileName && params.fileType) {
        const file = new File(
          [new Uint8Array(params.buffer)],
          params.fileName,
          {
            type: params.fileType
          }
        )
        dataTransfer.items.add(file)
      }

      if (params.url) {
        dataTransfer.setData('text/uri-list', params.url)
        dataTransfer.setData('text/x-moz-url', params.url)
      }

      const targetElement = document.elementFromPoint(
        params.dropPosition.x,
        params.dropPosition.y
      )

      if (!targetElement) {
        throw new Error(
          `No element found at drop position: (${params.dropPosition.x}, ${params.dropPosition.y}). ` +
            `document.elementFromPoint returned null. Ensure the target is visible and not obscured.`
        )
      }

      const eventOptions = {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: params.dropPosition.x,
        clientY: params.dropPosition.y
      }

      const dragOverEvent = new DragEvent('dragover', eventOptions)
      const dropEvent = new DragEvent('drop', eventOptions)

      const graphCanvasElement = document.querySelector('#graph-canvas')

      // Keep Litegraph's drag-over node tracking in sync when the drop target is a
      // Vue node DOM overlay outside of the graph canvas element.
      if (graphCanvasElement && !graphCanvasElement.contains(targetElement)) {
        graphCanvasElement.dispatchEvent(
          new DragEvent('dragover', eventOptions)
        )
      }

      if (!params.preserveNativePropagation) {
        Object.defineProperty(dropEvent, 'preventDefault', {
          value: () => {},
          writable: false
        })

        Object.defineProperty(dropEvent, 'stopPropagation', {
          value: () => {},
          writable: false
        })
      }

      targetElement.dispatchEvent(dragOverEvent)
      targetElement.dispatchEvent(dropEvent)

      return {
        success: true,
        targetInfo: {
          tagName: targetElement.tagName,
          id: targetElement.id,
          classList: Array.from(targetElement.classList)
        }
      }
    }, evaluateParams)

    if (uploadResponsePromise) {
      await uploadResponsePromise
    }

    await this.nextFrame()
  }

  async dragAndDropFile(
    fileName: string,
    options: { dropPosition?: Position; waitForUpload?: boolean } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ fileName, ...options })
  }

  async dragAndDropURL(
    url: string,
    options: {
      dropPosition?: Position
      preserveNativePropagation?: boolean
    } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ url, ...options })
  }
}
