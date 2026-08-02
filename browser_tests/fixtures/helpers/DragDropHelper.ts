import { readFileSync } from 'fs'
import { basename } from 'path'

import type { Page } from '@playwright/test'

import type { Position } from '@e2e/fixtures/types'
import { getMimeType } from '@e2e/fixtures/utils/mimeTypeUtil'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { nextFrame } from '@e2e/fixtures/utils/timing'

interface DroppedFilePayload {
  fileName: string
  fileType: string
  buffer: number[]
}

function readDroppedFile(
  fileName?: string,
  filePath?: string
): DroppedFilePayload {
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

  return {
    fileName: displayName,
    fileType: getMimeType(displayName),
    buffer: [...new Uint8Array(buffer)]
  }
}

export class DragDropHelper {
  constructor(private readonly page: Page) {}

  private async dispatchDrop(evaluateParams: {
    dropPosition: Position
    files: DroppedFilePayload[]
    url?: string
    preserveNativePropagation: boolean
  }): Promise<void> {
    await this.page.evaluate(async (params) => {
      const dataTransfer = new DataTransfer()

      for (const file of params.files) {
        dataTransfer.items.add(
          new File([new Uint8Array(file.buffer)], file.fileName, {
            type: file.fileType
          })
        )
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
    }, evaluateParams)
  }

  async dragAndDropExternalResource(
    options: {
      fileName?: string
      filePath?: string
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
      url,
      waitForUpload = false,
      preserveNativePropagation = false
    } = options

    if (!fileName && !filePath && !url)
      throw new Error('Must provide fileName, filePath, or url')

    const files: DroppedFilePayload[] =
      fileName || filePath ? [readDroppedFile(fileName, filePath)] : []

    const uploadResponsePromise = waitForUpload
      ? this.page.waitForResponse(
          (resp) => resp.url().includes('/upload/') && resp.status() === 200,
          { timeout: 10000 }
        )
      : null

    await this.dispatchDrop({
      dropPosition,
      files,
      url,
      preserveNativePropagation
    })

    if (uploadResponsePromise) {
      await uploadResponsePromise
    }

    await nextFrame(this.page)
  }

  /**
   * Drops multiple files onto the canvas in a single DragEvent, mirroring an
   * OS-level multi-file drag. Use this (rather than several single-file
   * drops) whenever the app's batching/spacing behavior for a mixed set of
   * files dropped together needs to be exercised.
   */
  async dragAndDropFiles(
    fileNames: string[],
    options: {
      dropPosition?: Position
      waitForUpload?: boolean
      preserveNativePropagation?: boolean
    } = {}
  ): Promise<void> {
    const {
      dropPosition = { x: 100, y: 100 },
      waitForUpload = false,
      preserveNativePropagation = false
    } = options

    if (fileNames.length === 0)
      throw new Error('Must provide at least one fileName')

    const files = fileNames.map((fileName) => readDroppedFile(fileName))

    const uploadResponsePromise = waitForUpload
      ? this.page.waitForResponse(
          (resp) => resp.url().includes('/upload/') && resp.status() === 200,
          { timeout: 10000 }
        )
      : null

    await this.dispatchDrop({ dropPosition, files, preserveNativePropagation })

    if (uploadResponsePromise) {
      await uploadResponsePromise
    }

    await nextFrame(this.page)
  }

  async dragAndDropFile(
    fileName: string,
    options: { dropPosition?: Position; waitForUpload?: boolean } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ fileName, ...options })
  }

  async dragAndDropFilePath(
    filePath: string,
    options: { dropPosition?: Position; waitForUpload?: boolean } = {}
  ): Promise<void> {
    return this.dragAndDropExternalResource({ filePath, ...options })
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
