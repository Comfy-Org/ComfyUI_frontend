import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { chromium } from '@playwright/test'
import { build } from 'vite'

import { isWorkshopCloudEnv } from '../src/config/workshop-cloud-env'
import { WORKSHOP_ROUTER_BASE_URL } from '../src/config/workshop-env'
import type { createWorkshopUrlUploader } from '../src/config/workshop-url-upload'

declare global {
  interface Window {
    WorkshopUploadProbe: {
      createWorkshopUrlUploader: typeof createWorkshopUrlUploader
    }
  }
}

async function main() {
  const { values } = parseArgs({
    options: { origin: { type: 'string' }, help: { type: 'boolean' } }
  })
  if (values.help) {
    process.stdout.write(
      'COMFY_API_KEY=... PUBLIC_WORKSHOP_CLOUD_ENV=prod pnpm --filter @comfyorg/website test:workshop-upload --origin https://comfy.org\nTests real browser grant, signed PUT and image decoding. Uploads one tiny PNG; never runs a model. Does not save credentials or signed URLs.\n'
    )
    return
  }
  const environment = process.env.PUBLIC_WORKSHOP_CLOUD_ENV
  const token = process.env.COMFY_API_KEY
  if (!token || !isWorkshopCloudEnv(environment) || !values.origin)
    throw new Error(
      'Set COMFY_API_KEY, PUBLIC_WORKSHOP_CLOUD_ENV and --origin explicitly'
    )
  const origin = new URL(values.origin)
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password
  )
    throw new Error('Expected an HTTP(S) origin without credentials')
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    define: {
      'import.meta.env.PUBLIC_WORKSHOP_CLOUD_ENV': JSON.stringify(environment)
    },
    build: {
      write: false,
      lib: {
        entry: fileURLToPath(
          new URL('../src/config/workshop-url-upload.ts', import.meta.url)
        ),
        name: 'WorkshopUploadProbe',
        formats: ['iife']
      }
    }
  })
  const chunks = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(
    (result) => ('output' in result ? result.output : [])
  )
  const entry = chunks.find((chunk) => chunk.type === 'chunk' && chunk.isEntry)
  if (!entry || entry.type !== 'chunk')
    throw new Error('Upload probe bundle is missing')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const probeUrl = new URL('/__workshop-upload-probe', origin).href
    await page.route(probeUrl, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Workshop upload probe</title>'
      })
    )
    await page.goto(probeUrl)
    await page.addScriptTag({ content: entry.code })
    const result = await page.evaluate(async (token) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      canvas.getContext('2d')?.fillRect(0, 0, 1, 1)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('PNG unavailable')),
          'image/png'
        )
      )
      const file = new File([blob], 'workshop-upload-probe.png', {
        type: 'image/png'
      })
      try {
        const url =
          await window.WorkshopUploadProbe.createWorkshopUrlUploader()(
            file,
            token,
            'browser-upload-probe',
            AbortSignal.timeout(30_000)
          )
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.src = url
        await image.decode()
        return {
          passed: image.naturalWidth === 1 && image.naturalHeight === 1,
          stage: 'decode',
          bytes: file.size
        }
      } catch (error) {
        const stage =
          error &&
          typeof error === 'object' &&
          'stage' in error &&
          typeof error.stage === 'string'
            ? error.stage
            : 'decode'
        return { passed: false, stage, bytes: file.size }
      }
    }, token)
    process.stdout.write(
      `${JSON.stringify({ checkedAt: new Date().toISOString(), environment, router: WORKSHOP_ROUTER_BASE_URL, origin: origin.origin, ...result })}\n`
    )
    if (!result.passed) process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.name : 'Error'}: browser upload probe could not finish\n`
  )
  process.exitCode = 1
})
