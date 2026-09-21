import { chromium } from '@playwright/test'
import type { Browser } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

import type { WorkshopSvgRasterizer } from '../src/config/workshop-svg-output'

export function openRouterSvgRasterizer(): {
  rasterize: WorkshopSvgRasterizer
  close: () => Promise<void>
} {
  let browser: Promise<Browser> | undefined
  function loadModule() {
    return readFile(
      new URL('../src/config/workshop-svg-rasterizer.ts', import.meta.url),
      'utf8'
    ).then((source) => {
      const compiled = transpileModule(source, {
        compilerOptions: {
          target: ScriptTarget.ES2022,
          module: ModuleKind.ESNext
        }
      })
      return `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`
    })
  }
  let moduleUrl: ReturnType<typeof loadModule> | undefined
  const lifetime = new AbortController()
  let active = 0
  const waiting: (() => void)[] = []
  async function acquire(signal: AbortSignal) {
    signal.throwIfAborted()
    if (active < 4) {
      active += 1
      return
    }
    await new Promise<void>((resolve, reject) => {
      function ready() {
        signal.removeEventListener('abort', abort)
        resolve()
      }
      function abort() {
        waiting.splice(waiting.indexOf(ready), 1)
        reject(signal.reason)
      }
      signal.addEventListener('abort', abort, { once: true })
      waiting.push(ready)
    })
  }
  async function rasterize(svg: string, signal?: AbortSignal): Promise<Blob> {
    const requestSignal = AbortSignal.any([
      lifetime.signal,
      AbortSignal.timeout(10_000),
      ...(signal ? [signal] : [])
    ])
    await acquire(requestSignal)
    let closePage: (() => Promise<void>) | undefined
    try {
      requestSignal.throwIfAborted()
      browser ??= chromium.launch({ headless: true, timeout: 10_000 })
      const page = await (await browser).newPage()
      closePage = () => page.close()
      const abort = () => {
        void page.close().catch(() => {})
      }
      requestSignal.addEventListener('abort', abort, { once: true })
      try {
        requestSignal.throwIfAborted()
        await page.route('http{,s}://**/*', (route) => route.abort())
        const png = await page.evaluate(
          async ({ url, svg }) => {
            const renderer = await import(url)
            const result: unknown = await renderer.rasterizeSvgImage({ svg })
            if (typeof result !== 'string')
              throw new Error('Invalid rasterized image')
            return result
          },
          { url: await (moduleUrl ??= loadModule()), svg }
        )
        requestSignal.throwIfAborted()
        return new Blob(
          [Buffer.from(png.replace(/^data:image\/png;base64,/, ''), 'base64')],
          { type: 'image/png' }
        )
      } finally {
        requestSignal.removeEventListener('abort', abort)
      }
    } finally {
      await closePage?.().catch(() => {})
      const next = waiting.shift()
      if (next) next()
      else active -= 1
    }
  }
  return {
    rasterize,
    async close() {
      lifetime.abort(new Error('SVG renderer closed'))
      await browser?.then(
        (instance) => instance.close(),
        () => {}
      )
    }
  }
}
