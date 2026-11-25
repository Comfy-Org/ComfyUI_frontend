import { readFile } from 'node:fs/promises'
import { mergeTests } from '@playwright/test'
import ts from 'typescript'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

const menuCompatibilityFixture = base.extend<{
  menuScenario: 'portable' | 'native' | 'ecosystem'
  menuExtension: void
}>({
  menuScenario: ['portable', { option: true }],
  menuExtension: [
    async ({ page, menuScenario }, use) => {
      await page.route('**/extensions', async (route) => {
        const response = await route.fetch()
        const extensions: unknown = await response.json()
        if (
          !Array.isArray(extensions) ||
          !extensions.every((item) => typeof item === 'string')
        )
          throw new Error('Expected an extension URL list')
        await route.fulfill({
          json: [
            ...extensions,
            `/extensions/menu-compatibility/main.js?scenario=${menuScenario}`
          ]
        })
      })
      await page.route(
        '**/extensions/menu-compatibility/main.js*',
        async (route) => {
          const response = await route.fetch({
            url: new URL(
              '/tools/devtools/menuCompatibility.ts',
              route.request().url()
            ).href
          })
          if (response.headers()['content-type']?.includes('javascript')) {
            await route.fulfill({ response })
          } else {
            const source = await readFile(
              'tools/devtools/menuCompatibility.ts',
              'utf8'
            )
            const body = ts
              .transpileModule(source, {
                compilerOptions: {
                  target: ts.ScriptTarget.ES2022,
                  module: ts.ModuleKind.ESNext
                }
              })
              .outputText.replaceAll('@/scripts/app', '/scripts/app.js')
            await route.fulfill({ contentType: 'text/javascript', body })
          }
        }
      )
      await use()
    },
    { auto: true }
  ]
})

export const test = mergeTests(comfyPageFixture, menuCompatibilityFixture)
