import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

function runInFreshProcessWithPublishedModule(script: string) {
  const moduleUrl = pathToFileURL(resolve('public/comfy/api/v4.js')).href
  const { error, status, stderr } = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script, moduleUrl],
    { encoding: 'utf8', timeout: 10_000 }
  )
  return { error, status, stderr }
}

describe('the published module', () => {
  it('exports the API the host installed, not a copy of it', () => {
    const result = runInFreshProcessWithPublishedModule(`
      import assert from 'node:assert/strict'
      const installed = Object.freeze({})
      globalThis.comfy_v4 = installed
      const { comfy } = await import(process.argv[1])
      assert.strictEqual(comfy, installed)
    `)

    expect(result).toEqual({ error: undefined, status: 0, stderr: '' })
  })

  it('refuses to load before the host has installed the API', () => {
    const result = runInFreshProcessWithPublishedModule(`
      import assert from 'node:assert/strict'
      await assert.rejects(import(process.argv[1]), {
        name: 'Error',
        message: /has no API to export/
      })
    `)

    expect(result).toEqual({ error: undefined, status: 0, stderr: '' })
  })

  it('is mapped to the path the frontend is served from', () => {
    const html = readFileSync('index.html', 'utf8')
    const source = html.match(
      /<script type="importmap">\s*([\s\S]*?)\s*<\/script>/
    )?.[1]

    expect(
      JSON.parse((source ?? '{}').replaceAll('%BASE_URL%', '/ComfyUI/'))
    ).toMatchObject({
      imports: { '/comfy/api/v4.js': '/ComfyUI/comfy/api/v4.js' }
    })
  })
})
