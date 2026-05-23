import type { Page } from '@playwright/test'

export async function interceptClipboardWrite(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __copiedText?: string }
    w.__copiedText = ''
    navigator.clipboard.writeText = async (text: string) => {
      w.__copiedText = text
    }
  })
}

export async function getClipboardText(page: Page): Promise<string> {
  return (
    (await page.evaluate(
      () => (window as Window & { __copiedText?: string }).__copiedText
    )) ?? ''
  )
}
