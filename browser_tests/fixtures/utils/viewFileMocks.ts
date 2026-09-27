import type { Page, Route } from '@playwright/test'

type RouteFulfillOptions = NonNullable<Parameters<Route['fulfill']>[0]>

type ViewFile = Pick<RouteFulfillOptions, 'body' | 'contentType' | 'path'>

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwPIRwAAAABJRU5ErkJggg==',
  'base64'
)

export async function mockViewFiles(
  page: Page,
  filesByName: Readonly<Record<string, ViewFile>>
) {
  await page.route('**/api/view**', async (route) => {
    if (route.request().method().toUpperCase() !== 'GET') {
      await route.fallback()
      return
    }

    const filename = new URL(route.request().url()).searchParams.get('filename')
    if (!filename) {
      await route.fulfill({
        status: 400,
        json: { error: 'Missing filename' } satisfies { error: string }
      })
      return
    }

    const file = filesByName[filename]
    if (!file) {
      await route.fulfill({
        status: 404,
        json: {
          error: `Unknown filename: ${filename}`
        } satisfies { error: string }
      })
      return
    }

    await route.fulfill({
      body: file.body ?? (file.path ? undefined : transparentPng),
      contentType: file.contentType ?? 'image/png',
      path: file.path
    })
  })
}
