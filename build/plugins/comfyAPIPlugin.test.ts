import { fromPartial } from '@total-typescript/shoehorn'
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

import { comfyAPIPlugin } from './comfyAPIPlugin'

describe('comfyAPIPlugin transform', () => {
  const root = process.cwd()
  const source = 'export const api = 1\nexport function helper() {}\n'

  function runTransform(isDev: boolean, id: string, code = source) {
    const emitFile = vi.fn()
    const handler = comfyAPIPlugin(isDev).transform
    const context = fromPartial<ThisParameterType<typeof handler>>({ emitFile })
    const result = handler.call(context, code, id)
    return { result, emitFile }
  }

  it.for([
    {
      name: "does not match another package's src/scripts",
      id: path.join(root, 'apps/website/src/scripts/customerio.ts')
    },
    {
      name: "does not match another package's src/extensions/core",
      id: path.join(root, 'apps/website/src/extensions/core/whatever.ts')
    },
    {
      name: 'does not match non-.ts files',
      id: path.join(root, 'src/scripts/api.vue')
    },
    {
      name: 'does not match src/ files outside legacy directories',
      id: path.join(root, 'src/components/App.ts')
    },
    {
      name: 'does not match files entirely outside src/',
      id: path.join(root, 'build/plugins/other.ts')
    },
    {
      name: 'does not match sibling directory names starting with scripts',
      id: path.join(root, 'src/scripts-old/api.ts')
    }
  ])('$name', ({ id }) => {
    const { result, emitFile } = runTransform(false, id)

    expect(result).toBeUndefined()
    expect(emitFile).not.toHaveBeenCalled()
  })

  it('emits an output-root-relative shim for a legacy scripts/ file', () => {
    const { result, emitFile } = runTransform(
      false,
      path.join(root, 'src/scripts/api.ts')
    )

    expect(emitFile).toHaveBeenCalledTimes(1)
    const asset = emitFile.mock.calls[0][0]
    expect(asset.type).toBe('asset')
    expect(asset.fileName).toBe('scripts/api.js')
    expect(asset.source).toContain(
      'export const api = window.comfyAPI.api.api;'
    )
    expect(asset.source).toContain(
      'export const helper = window.comfyAPI.api.helper;'
    )
    expect(asset.source).not.toContain('console.warn')
    expect(result?.code).toContain('window.comfyAPI.api.api = api;')
  })

  it.for([
    'addValueControlWidget',
    'addValueControlWidgets',
    'updateControlWidgetLabel'
  ])('keeps %s in the scripts/widgets.js shim for custom nodes', (name) => {
    const id = path.join(root, 'src/scripts/widgets.ts')
    const { emitFile } = runTransform(false, id, readFileSync(id, 'utf8'))

    expect(emitFile.mock.calls[0][0].source).toContain(
      `export const ${name} = window.comfyAPI.widgets.${name};`
    )
  })

  it('derives the module name from an id with Windows separators', () => {
    const { result, emitFile } = runTransform(
      false,
      `${path.join(root, 'src/scripts')}\\api.ts`
    )

    expect(result?.code).toContain('window.comfyAPI.api.api = api;')
    expect(emitFile.mock.calls[0][0].fileName).toBe('scripts/api.js')
  })

  it('emits a deprecation warning shim for a deprecated legacy file', () => {
    const { emitFile } = runTransform(
      false,
      path.join(root, 'src/extensions/core/groupNode.ts')
    )

    expect(emitFile).toHaveBeenCalledTimes(1)
    const asset = emitFile.mock.calls[0][0]
    expect(asset.fileName).toBe('extensions/core/groupNode.js')
    expect(asset.source).toContain('[ComfyUI Deprecated]')
  })

  it('is a no-op in dev', () => {
    const { result, emitFile } = runTransform(
      true,
      path.join(root, 'src/scripts/api.ts')
    )

    expect(result).toBeNull()
    expect(emitFile).not.toHaveBeenCalled()
  })
})
