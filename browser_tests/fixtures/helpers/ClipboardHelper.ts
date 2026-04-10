import { readFileSync } from 'fs'
import { basename } from 'path'

import type { Locator, Page } from '@playwright/test'

import type { KeyboardHelper } from '@e2e/fixtures/helpers/KeyboardHelper'
import { getMimeType } from '@e2e/fixtures/helpers/mimeTypeUtil'

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

    // Register a one-time capturing-phase listener that intercepts the next
    // paste event and injects file data onto clipboardData.
    await this.page.evaluate(
      ({ bufferArray, fileName, fileType }) => {
        document.addEventListener(
          'paste',
          (e: ClipboardEvent) => {
            e.preventDefault()
            e.stopImmediatePropagation()

            const file = new File([new Uint8Array(bufferArray)], fileName, {
              type: fileType
            })
            const dataTransfer = new DataTransfer()
            dataTransfer.items.add(file)

            const syntheticEvent = new ClipboardEvent('paste', {
              clipboardData: dataTransfer,
              bubbles: true,
              cancelable: true
            })
            document.dispatchEvent(syntheticEvent)
          },
          { capture: true, once: true }
        )
      },
      { bufferArray, fileName, fileType }
    )

    // Trigger a real Ctrl+V keystroke — the capturing listener above will
    // intercept it and re-dispatch with file data attached.
    await this.paste()
  }
}
