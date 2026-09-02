import path from 'path'
import type { Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'

import { comfyAPIPlugin, isLegacyFile } from './comfyAPIPlugin'

describe('isLegacyFile', () => {
  const srcRoot = '/repo/src'

  it.for([
    {
      name: "matches this package's own legacy scripts/",
      id: '/repo/src/scripts/api.ts',
      expected: true
    },
    {
      name: "matches this package's own legacy extensions/core/",
      id: '/repo/src/extensions/core/groupNode.ts',
      expected: true
    },
    {
      name: "does not match another package's src/scripts",
      id: '/repo/apps/website/src/scripts/customerio.ts',
      expected: false
    },
    {
      name: "does not match another package's src/extensions/core",
      id: '/repo/apps/website/src/extensions/core/whatever.ts',
      expected: false
    },
    {
      name: 'does not match non-.ts files',
      id: '/repo/src/scripts/api.vue',
      expected: false
    },
    {
      name: 'does not match src/ files outside legacy directories',
      id: '/repo/src/components/App.ts',
      expected: false
    },
    {
      name: 'does not match files entirely outside src/',
      id: '/repo/build/plugins/other.ts',
      expected: false
    },
    {
      name: 'does not match sibling directory names starting with scripts',
      id: '/repo/src/scripts-old/api.ts',
      expected: false
    }
  ])('$name', ({ id, expected }) => {
    expect(isLegacyFile(id, srcRoot)).toBe(expected)
  })

  it('defaults the base to <cwd>/src', () => {
    const root = process.cwd()
    expect(isLegacyFile(path.join(root, 'src/scripts/api.ts'))).toBe(true)
    expect(
      isLegacyFile(path.join(root, 'apps/website/src/scripts/customerio.ts'))
    ).toBe(false)
  })
})

describe('comfyAPIPlugin transform', () => {
  const root = process.cwd()
  const source = 'export const api = 1\nexport function helper() {}\n'

  function runTransform(isDev: boolean, id: string) {
    const emitFile = vi.fn()
    const hook = comfyAPIPlugin(isDev).transform as NonNullable<
      Plugin['transform']
    >
    const handler = typeof hook === 'function' ? hook : hook.handler
    const context = { emitFile } as unknown as ThisParameterType<typeof handler>
    const result = handler.call(context, source, id) as
      | { code: string; map: null }
      | null
      | undefined
    return { result, emitFile }
  }

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

  it("does not touch another package's src/scripts file", () => {
    const { result, emitFile } = runTransform(
      false,
      path.join(root, 'apps/website/src/scripts/customerio.ts')
    )

    expect(emitFile).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
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
