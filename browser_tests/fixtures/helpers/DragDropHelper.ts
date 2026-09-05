import { readFileSync } from 'fs'
import { basename } from 'path'

import type { Page, Response } from '@playwright/test'

import type { Position } from '@e2e/fixtures/types'
import { getMimeType } from '@e2e/fixtures/utils/mimeTypeUtil'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { nextFrame } from '@e2e/fixtures/utils/timing'

function isUploadSuccessResponse(response: Response): boolean {
  return response.url().includes('/upload/') && response.status() === 200
}

/**
 * Resolves once `count` distinct `/upload/` 200 responses have been seen.
 *
 * `page.waitForResponse()` with the same predicate called `count` times
 * doesn't work for this: every one of those listeners matches the first
 * `/upload/` 200 that arrives, so a `Promise.all` over them resolves after
 * one upload rather than `count`. Counting matching events off a single
 * `page.on('response', ...)` listener instead ties resolution to how many
 * matching responses actually arrived.
 */
function waitForUploadResponses(
  page: Page,
  count: number,
  timeout = 10000
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let seen = 0

    const onResponse = (response: Response) => {
      if (!isUploadSuccessResponse(response)) return
      seen++
      if (seen < count) return
      clearTimeout(timer)
      page.off('response', onResponse)
      resolve()
    }

    const timer = setTimeout(() => {
      page.off('response', onResponse)
      reject(
        new Error(
          `Timed out waiting for ${count} /upload/ response(s); saw ${seen}.`
        )
      )
    }, timeout)

    page.on('response', onResponse)
  })
}

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

    // One DragEvent can carry N files, each triggering its own upload
    // request - wait for N distinct upload responses, not just the first
    // one, or callers uploading multiple files get a false all-clear.
    const uploadResponsePromise = waitForUpload
      ? waitForUploadResponses(this.page, files.length)
      : null

    await this.dispatchDrop({ dropPosition, files, preserveNativePropagation })

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
