import { readFileSync } from 'fs'
import { basename } from 'path'

import type { Locator, Page } from '@playwright/test'

import type { KeyboardHelper } from '@e2e/fixtures/helpers/KeyboardHelper'
import { getMimeType } from '@e2e/fixtures/utils/mimeTypeUtil'

function readFilePayload(filePath: string) {
  const buffer = readFileSync(filePath)
  const bufferArray = [...new Uint8Array(buffer)]
  const fileName = basename(filePath)
  const fileType = getMimeType(fileName)

  return { bufferArray, fileName, fileType }
}

async function dispatchFilePaste(
  page: Page,
  payload: ReturnType<typeof readFilePayload>
): Promise<void> {
  await page.evaluate(({ bufferArray, fileName, fileType }) => {
    const file = new File([new Uint8Array(bufferArray)], fileName, {
      type: fileType
    })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)

    const target = document.activeElement ?? document
    target.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      })
    )
  }, payload)
}

async function interceptNextFilePaste(
  page: Page,
  payload: ReturnType<typeof readFilePayload>
): Promise<void> {
  await page.evaluate(({ bufferArray, fileName, fileType }) => {
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

        document.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          })
        )
      },
      { capture: true, once: true }
    )
  }, payload)
}

type PasteFileOptions = {
  mode?: 'keyboard' | 'direct'
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

  async pasteFile(
    filePath: string,
    { mode = 'keyboard' }: PasteFileOptions = {}
  ): Promise<void> {
    const payload = readFilePayload(filePath)

    if (mode === 'keyboard') {
      await interceptNextFilePaste(this.page, payload)
      await this.paste()
      return
    }

    // Browser clipboard APIs cannot reliably seed arbitrary files in tests.
    // Dispatch the app-level paste event with file clipboardData directly.
    await dispatchFilePaste(this.page, payload)
  }
}
