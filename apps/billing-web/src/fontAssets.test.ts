// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolveConfig } from 'vite'

const designSystemFontUrls = [
  ...readFileSync(
    createRequire(import.meta.url).resolve(
      '@comfyorg/design-system/css/fonts.css'
    ),
    'utf8'
  ).matchAll(/url\('([^']+)'\)/g)
].map(([, url]) => url)

describe('design-system font faces', () => {
  it('declares the Inter faces this app must ship', () => {
    expect(designSystemFontUrls).toEqual([
      '/fonts/inter-latin-normal.woff2',
      '/fonts/inter-latin-italic.woff2'
    ])
  })

  it.for(designSystemFontUrls)('resolves %s to a bundled file', async (url) => {
    const config = await resolveConfig(
      {
        configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url))
      },
      'build'
    )
    const resolved = await config.createResolver()(url)

    expect(resolved && existsSync(resolved)).toBe(true)
  })
})
