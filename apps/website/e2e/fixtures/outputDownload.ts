import { readFileSync } from 'node:fs'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

import type * as OutputDownloadModule from '../../src/config/workshop-output-download'
import { test as base } from './blockExternalMedia'

const compiled = transpileModule(
  readFileSync(
    new URL('../../src/config/workshop-output-download.ts', import.meta.url),
    'utf8'
  ),
  {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext }
  }
)
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`

export const test = base.extend<{
  outputDownload: { release: () => void; url: string }
}>({
  outputDownload: async ({ page, context }, use) => {
    const failed = Promise.withResolvers<void>()
    const url = 'https://output.example/render.png'
    await context.route(url, async (route) => {
      if (route.request().isNavigationRequest())
        return route.fulfill({
          contentType: 'text/html',
          body: '<p>Provider output</p>'
        })
      await failed.promise
      return route.fulfill({
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'Download failed'
      })
    })
    await page.setContent('<button type="button">Download output</button>')
    await page.evaluate(
      async ({ moduleUrl, url }) => {
        const { downloadOutput }: typeof OutputDownloadModule = await import(
          moduleUrl
        )
        const button = document.querySelector('button')
        if (!button) throw new Error('Missing download button')
        button.addEventListener('click', () => {
          void downloadOutput(url, 'render.png')
        })
      },
      { moduleUrl, url }
    )
    try {
      await use({ release: () => failed.resolve(), url })
    } finally {
      failed.resolve()
    }
  }
})
