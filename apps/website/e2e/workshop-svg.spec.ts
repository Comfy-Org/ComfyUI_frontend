import { expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

import { openRouterSvgRasterizer } from '../scripts/router-model-svg'
import { test } from './fixtures/blockExternalMedia'

const source = readFileSync(
  new URL('../src/config/workshop-svg-rasterizer.ts', import.meta.url),
  'utf8'
)
const compiled = transpileModule(source, {
  compilerOptions: {
    target: ScriptTarget.ES2022,
    module: ModuleKind.ESNext
  }
})
const rendererUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`

test('SVG previews rasterize visible pixels without scripts or external requests', async ({
  page
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url())
  })
  const result = await page.evaluate(async (url) => {
    const renderer = await import(url)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" onload="document.title='executed'">
      <script>document.title='executed';fetch('https://unexpected.invalid/script')</script>
      <style>@import url('https://unexpected.invalid/style');</style>
      <rect width="8" height="8" fill="red"/>
      <image href="https://unexpected.invalid/image.png" width="4" height="4"/>
      <use href="https://unexpected.invalid/other.svg#shape"/>
    </svg>`
    const png: unknown = await renderer.rasterizeSvgImage({ svg })
    if (typeof png !== 'string') throw new Error('Expected rasterized PNG')
    const image = new Image()
    image.src = png
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0)
    return {
      png: png.slice(0, 22),
      width: image.naturalWidth,
      height: image.naturalHeight,
      pixel: [...context.getImageData(7, 7, 1, 1).data],
      title: document.title
    }
  }, rendererUrl)
  expect(result).toEqual({
    png: 'data:image/png;base64,',
    width: 8,
    height: 8,
    pixel: [255, 0, 0, 255],
    title: ''
  })
  expect(requests).toEqual([])
})

test('SVG previews reject invalid documents and resource limits', async ({
  page
}) => {
  const errors = await page.evaluate(async (url) => {
    const renderer = await import(url)
    const cases = [
      '<svg',
      '<!DOCTYPE svg [<!ENTITY external SYSTEM "https://unexpected.invalid/entity">]><svg xmlns="http://www.w3.org/2000/svg">&external;</svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="8192" height="8192"/>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">' +
        ' '.repeat(4 * 1024 * 1024) +
        '</svg>'
    ]
    return Promise.all(
      cases.map(async (svg) => {
        try {
          await renderer.rasterizeSvgImage({ svg })
          return 'unexpected success'
        } catch (error) {
          return error instanceof Error ? error.message : String(error)
        }
      })
    )
  }, rendererUrl)
  expect(errors).toEqual([
    'Invalid SVG document',
    'SVG exceeds the supported document limits',
    'SVG exceeds the supported image dimensions',
    'SVG exceeds the supported document limits'
  ])
})

test('SVG cancellation and success release all temporary Blob URLs', async ({
  page
}) => {
  const result = await page.evaluate(async (url) => {
    const renderer = await import(url)
    const live = new Set<string>()
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const value = create(blob)
      live.add(value)
      return value
    }
    URL.revokeObjectURL = (value) => {
      live.delete(value)
      revoke(value)
    }
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 8"><rect width="16" height="8"/></svg>'
    await renderer.rasterizeSvgImage({ svg })
    const afterSuccess = live.size
    const controller = new AbortController()
    const pending = renderer.rasterizeSvgImage({
      svg,
      signal: controller.signal
    })
    controller.abort(new Error('Cancelled'))
    let message = ''
    try {
      await pending
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    return { afterSuccess, afterCancel: live.size, message }
  }, rendererUrl)
  expect(result).toEqual({
    afterSuccess: 0,
    afterCancel: 0,
    message: 'Cancelled'
  })
})

test('the CLI renders in a bounded lazy browser and cancels queued work', async ({
  playwright,
  proxy
}) => {
  const { chromium } = playwright
  const launch = chromium.launch.bind(chromium)
  let launches = 0
  let active = 0
  let peak = 0
  const saturated = Promise.withResolvers<void>()
  chromium.launch = async (options) => {
    launches += 1
    const browser = await launch({ ...options, proxy })
    const newPage = browser.newPage.bind(browser)
    browser.newPage = async (options) => {
      const page = await newPage(options)
      active += 1
      peak = Math.max(peak, active)
      page.on('close', () => {
        active -= 1
      })
      if (active === 4) saturated.resolve()
      await saturated.promise
      return page
    }
    return browser
  }
  const unused = openRouterSvgRasterizer()
  const renderer = openRouterSvgRasterizer()
  try {
    await unused.close()
    expect(launches).toBe(0)
    const cancelled = new AbortController()
    const pending = Array.from({ length: 9 }, (_, index) =>
      renderer.rasterize(
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>',
        index === 4 ? cancelled.signal : undefined
      )
    )
    cancelled.abort(new Error('Queued SVG cancelled'))
    const results = await Promise.allSettled(pending)
    expect(results[4]).toMatchObject({
      status: 'rejected',
      reason: { message: 'Queued SVG cancelled' }
    })
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    expect(fulfilled).toHaveLength(8)
    for (const result of fulfilled) {
      expect(result.value.type).toBe('image/png')
      expect(
        Buffer.from(await result.value.arrayBuffer())
          .subarray(0, 8)
          .toString('hex')
      ).toBe('89504e470d0a1a0a')
    }
    expect(launches).toBe(1)
    expect(peak).toBe(4)
    expect(active).toBe(0)
  } finally {
    await renderer.close()
    chromium.launch = launch
  }
})
