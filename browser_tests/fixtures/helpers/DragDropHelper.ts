import { readFileSync } from 'fs'
import { basename } from 'path'

import type { Page } from '@playwright/test'

import type { Position } from '@e2e/fixtures/types'
import { getMimeType } from '@e2e/fixtures/utils/mimeTypeUtil'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { nextFrame } from '@e2e/fixtures/utils/timing'

export class DragDropHelper {
  constructor(private readonly page: Page) {}

  async dragAndDropExternalResource(
    options: {
      fileName?: string
      filePath?: string
      /**
       * A file whose bytes are generated inside the page instead of read from
       * disk. A file-size-limit case needs one larger than anything worth
       * committing as a fixture, and the disk path below ships its bytes
       * through `page.evaluate` as a plain number array — fine for a 6 KB clip,
       * ruinous for a 20 MB one.
       */
      generatedFile?: { name: string; type: string; byteLength: number }
      url?: string
      dropPosition?: Position
      waitForUpload?: boolean
      preserveNativePropagation?: boolean
    } = {}
  ): Promise<void> {
    const {
      dropPosition = { x: 100, y: 100 },
      fileName,
      filePath,
      generatedFile,
      url,
      waitForUpload = false,
      preserveNativePropagation = false
    } = options

    if (!fileName && !filePath && !url && !generatedFile)
      throw new Error('Must provide fileName, filePath, generatedFile, or url')

    const evaluateParams: {
      dropPosition: Position
      fileName?: string
      fileType?: string
      buffer?: Uint8Array | number[]
      byteLength?: number
      url?: string
      preserveNativePropagation: boolean
    } = { dropPosition, preserveNativePropagation }

    if (generatedFile) {
      evaluateParams.fileName = generatedFile.name
      evaluateParams.fileType = generatedFile.type
      evaluateParams.byteLength = generatedFile.byteLength
    }

    if (fileName || filePath) {
      const resolvedPath = filePath ?? assetPath(fileName!)
      const displayName = fileName ?? basename(resolvedPath)
      let buffer: Buffer
      try {
        buffer = readFileSync(resolvedPath)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(
          `Failed to read drag-and-drop fixture at "${resolvedPath}": ${reason}`,
          { cause: error }
        )
      }

      evaluateParams.fileName = displayName
      evaluateParams.fileType = getMimeType(displayName)
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

      const bytes =
        params.byteLength === undefined
          ? params.buffer && new Uint8Array(params.buffer)
          : new Uint8Array(params.byteLength)
      if (bytes && params.fileName && params.fileType) {
        const file = new File([bytes], params.fileName, {
          type: params.fileType
        })
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

    await nextFrame(this.page)
  }

  async dragAndDropFile(
    fileName: string,
    options: {
      dropPosition?: Position
      waitForUpload?: boolean
      preserveNativePropagation?: boolean
    } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ fileName, ...options })
  }

  async dragAndDropFilePath(
    filePath: string,
    options: { dropPosition?: Position; waitForUpload?: boolean } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ filePath, ...options })
  }

  async dragAndDropGeneratedFile(
    generatedFile: { name: string; type: string; byteLength: number },
    options: {
      dropPosition?: Position
      preserveNativePropagation?: boolean
    } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ generatedFile, ...options })
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
