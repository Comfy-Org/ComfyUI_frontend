import { readFileSync } from 'fs'
import { basename } from 'path'

import type { Locator, Page } from '@playwright/test'

import type { KeyboardHelper } from './KeyboardHelper'

function getMimeType(fileName: string): string {
  const name = fileName.toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  if (name.endsWith('.avif')) return 'image/avif'
  if (name.endsWith('.webm')) return 'video/webm'
  if (name.endsWith('.mp4')) return 'video/mp4'
  return 'application/octet-stream'
}

export class ClipboardHelper {
  constructor(
    private readonly keyboard: KeyboardHelper,
    private readonly page: Page
  ) {}

  async copy(locator?: Locator | null): Promise<void> {
    await this.keyboard.ctrlSend('KeyC', locator ?? null)
  }

  async paste(locator?: Locator | null): Promise<void> {
    await this.keyboard.ctrlSend('KeyV', locator ?? null)
  }

  async pasteFile(filePath: string): Promise<void> {
    const buffer = readFileSync(filePath)
    const bufferArray = [...new Uint8Array(buffer)]
    const fileName = basename(filePath)
    const fileType = getMimeType(fileName)

    await this.page.evaluate(
      ({ buf, name, type }) => {
        const file = new File([new Uint8Array(buf)], name, { type })
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        const event = new ClipboardEvent('paste', {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        })
        document.dispatchEvent(event)
      },
      { buf: bufferArray, name: fileName, type: fileType }
    )
  }
}
