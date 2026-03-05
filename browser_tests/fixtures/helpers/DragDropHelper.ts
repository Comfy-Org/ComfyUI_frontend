import { readFileSync } from 'fs'

import type { Page } from '@playwright/test'

import type { Position } from '../types'

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
    } = {}
  ): Promise<void> {
    const {
      dropPosition = { x: 100, y: 100 },
      fileName,
      url,
      waitForUpload = false
    } = options

    if (!fileName && !url)
      throw new Error('Must provide either fileName or url')

    const evaluateParams: {
      dropPosition: Position
      fileName?: string
      fileType?: string
      buffer?: Uint8Array | number[]
      url?: string
    } = { dropPosition }

    if (fileName) {
      const filePath = this.assetPath(fileName)
      const buffer = readFileSync(filePath)

      const getFileType = (fileName: string) => {
        if (fileName.endsWith('.png')) return 'image/png'
        if (fileName.endsWith('.svg')) return 'image/svg+xml'
        if (fileName.endsWith('.webp')) return 'image/webp'
        if (fileName.endsWith('.webm')) return 'video/webm'
        if (fileName.endsWith('.json')) return 'application/json'
        if (fileName.endsWith('.glb')) return 'model/gltf-binary'
        if (fileName.endsWith('.avif')) return 'image/avif'
        return 'application/octet-stream'
      }

      evaluateParams.fileName = fileName
      evaluateParams.fileType = getFileType(fileName)
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

      Object.defineProperty(dropEvent, 'preventDefault', {
        value: () => {},
        writable: false
      })

      Object.defineProperty(dropEvent, 'stopPropagation', {
        value: () => {},
        writable: false
      })

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

  async dragAndDropFiles(
    fileNames: string[],
    options: {
      dropPosition?: Position
      waitForUploadCount?: number
    } = {}
  ): Promise<void> {
    const { dropPosition = { x: 100, y: 100 }, waitForUploadCount = 0 } =
      options

    const files = fileNames.map((fileName) => {
      const filePath = this.assetPath(fileName)
      const buffer = readFileSync(filePath)

      const getFileType = (name: string) => {
        if (name.endsWith('.png')) return 'image/png'
        if (name.endsWith('.svg')) return 'image/svg+xml'
        if (name.endsWith('.webp')) return 'image/webp'
        if (name.endsWith('.webm')) return 'video/webm'
        if (name.endsWith('.json')) return 'application/json'
        if (name.endsWith('.glb')) return 'model/gltf-binary'
        if (name.endsWith('.avif')) return 'image/avif'
        return 'application/octet-stream'
      }

      return {
        fileName,
        fileType: getFileType(fileName),
        buffer: [...new Uint8Array(buffer)]
      }
    })

    let uploadResponsePromise: Promise<unknown> | null = null
    if (waitForUploadCount > 0) {
      let uploadCount = 0
      uploadResponsePromise = new Promise<void>((resolve) => {
        const handler = (resp: { url(): string; status(): number }) => {
          if (resp.url().includes('/upload/') && resp.status() === 200) {
            uploadCount++
            if (uploadCount >= waitForUploadCount) {
              this.page.off('response', handler)
              resolve()
            }
          }
        }
        this.page.on('response', handler)
      })
    }

    await this.page.evaluate(
      async (params) => {
        const dataTransfer = new DataTransfer()

        for (const f of params.files) {
          const file = new File([new Uint8Array(f.buffer)], f.fileName, {
            type: f.fileType
          })
          dataTransfer.items.add(file)
        }

        const targetElement = document.elementFromPoint(
          params.dropPosition.x,
          params.dropPosition.y
        )

        if (!targetElement) {
          throw new Error(
            `No element found at drop position: (${params.dropPosition.x}, ${params.dropPosition.y}).`
          )
        }

        const eventOptions = {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: params.dropPosition.x,
          clientY: params.dropPosition.y
        }

        const graphCanvasElement = document.querySelector('#graph-canvas')
        if (graphCanvasElement && !graphCanvasElement.contains(targetElement)) {
          graphCanvasElement.dispatchEvent(
            new DragEvent('dragover', eventOptions)
          )
        }

        const dropEvent = new DragEvent('drop', eventOptions)
        Object.defineProperty(dropEvent, 'preventDefault', {
          value: () => {},
          writable: false
        })
        Object.defineProperty(dropEvent, 'stopPropagation', {
          value: () => {},
          writable: false
        })

        targetElement.dispatchEvent(new DragEvent('dragover', eventOptions))
        targetElement.dispatchEvent(dropEvent)
      },
      { files, dropPosition }
    )

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
    options: { dropPosition?: Position } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ url, ...options })
  }
}
