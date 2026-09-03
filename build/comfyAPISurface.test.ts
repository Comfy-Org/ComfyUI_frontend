import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import { isComfyAPISourceFile } from './comfyAPISurface'
import { getPublishedExportNames } from './plugins/comfyAPIPlugin'

describe('isComfyAPISourceFile', () => {
  it.for([
    'src/extensions/core/clipspace.ts',
    'src/scripts/ui/imagePreview.ts'
  ])('publishes %s', (id) => {
    expect(isComfyAPISourceFile(id)).toBe(true)
  })

  it.for([
    'src/services/load3dService.ts',
    'src/stores/graphStore.ts',
    'src/extensions/core/SomeComponent.vue'
  ])('does not publish %s', (id) => {
    expect(isComfyAPISourceFile(id)).toBe(false)
  })
})

describe('getPublishedExportNames', () => {
  it('publishes each top-level declaration export', () => {
    const code = [
      'export class Dialog {}',
      'export const value = 1',
      'export async function load() {}',
      'class NotExported {}',
      'export type Ignored = string'
    ].join('\n')

    expect(getPublishedExportNames(code)).toEqual(['Dialog', 'value', 'load'])
  })

  // Regression guard for #10348, which dropped the `export` keyword here and
  // silently removed `window.comfyAPI.clipspace` and its generated shim.
  it('publishes ClipspaceDialog, which custom nodes import via the shim', async () => {
    const source = await readFile('src/extensions/core/clipspace.ts', 'utf8')

    expect(getPublishedExportNames(source)).toContain('ClipspaceDialog')
  })
})
