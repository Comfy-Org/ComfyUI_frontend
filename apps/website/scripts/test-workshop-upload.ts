import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { chromium } from '@playwright/test'
import { build } from 'vite'

import { isWorkshopCloudEnv } from '../src/config/workshop-cloud-env'
import type { WorkshopCloudEnv } from '../src/config/workshop-cloud-env'
import { WORKSHOP_ROUTER_BASE_URL } from '../src/config/workshop-env'
import { workshopUploadOrigin } from './workshop-upload-origin'
import type { runWorkshopUploadProbe } from './workshop-upload-probe'

declare global {
  interface Window {
    WorkshopUploadProbe: {
      runWorkshopUploadProbe: typeof runWorkshopUploadProbe
    }
  }
}

function probeSettings(value: string | undefined) {
  const environment = process.env.PUBLIC_WORKSHOP_CLOUD_ENV
  const token = process.env.COMFY_API_KEY
  if (!token || !isWorkshopCloudEnv(environment) || !value)
    throw new Error(
      'Set COMFY_API_KEY, PUBLIC_WORKSHOP_CLOUD_ENV and --origin explicitly'
    )
  return { environment, token, origin: workshopUploadOrigin(value) }
}

async function uploadProbeBundle(
  environment: WorkshopCloudEnv
): Promise<string> {
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
          new URL('./workshop-upload-probe.ts', import.meta.url)
        ),
        name: 'WorkshopUploadProbe',
        formats: ['iife']
      }
    }
  })
  const chunks = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(
    (result) => ('output' in result ? result.output : [])
  )
  const entry = chunks
    .filter((chunk) => chunk.type === 'chunk')
    .find((chunk) => chunk.isEntry)
  if (!entry) throw new Error('Upload probe bundle is missing')
  return entry.code
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
  const { environment, token, origin } = probeSettings(values.origin)
  const bundle = await uploadProbeBundle(environment)
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
    await page.addScriptTag({ content: bundle })
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
      return window.WorkshopUploadProbe.runWorkshopUploadProbe(file, token)
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
