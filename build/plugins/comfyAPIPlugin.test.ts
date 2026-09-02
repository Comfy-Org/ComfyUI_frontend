import path from 'path'
import type { Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'

import { comfyAPIPlugin, isLegacyFile } from './comfyAPIPlugin'

describe('isLegacyFile', () => {
  // Fixed base so the cases below do not depend on the host cwd, and so a
  // future change to how the plugin derives its base cannot silently keep
  // these green by drifting in lockstep with the inputs.
  const srcRoot = '/repo/src'

  it("matches this package's own legacy scripts/", () => {
    expect(isLegacyFile('/repo/src/scripts/api.ts', srcRoot)).toBe(true)
  })

  it("matches this package's own legacy extensions/core/", () => {
    expect(
      isLegacyFile('/repo/src/extensions/core/groupNode.ts', srcRoot)
    ).toBe(true)
  })

  it("does not match another package's src/scripts (e.g. apps/website)", () => {
    // Regression: apps/website/src/scripts/customerio.ts previously matched
    // via a bare "src/scripts" substring check, breaking storybook-build
    // (RolldownError: relative fileName for the emitted shim asset).
    expect(
      isLegacyFile('/repo/apps/website/src/scripts/customerio.ts', srcRoot)
    ).toBe(false)
  })

  it("does not match another package's src/extensions/core", () => {
    expect(
      isLegacyFile(
        '/repo/apps/website/src/extensions/core/whatever.ts',
        srcRoot
      )
    ).toBe(false)
  })

  it('does not match non-.ts files', () => {
    expect(isLegacyFile('/repo/src/scripts/api.vue', srcRoot)).toBe(false)
  })

  it('does not match src/ files outside scripts/ or extensions/core/', () => {
    expect(isLegacyFile('/repo/src/components/App.ts', srcRoot)).toBe(false)
  })

  it('does not match files entirely outside src/', () => {
    expect(isLegacyFile('/repo/build/plugins/other.ts', srcRoot)).toBe(false)
  })

  it('does not match a sibling directory whose name starts with scripts', () => {
    expect(isLegacyFile('/repo/src/scripts-old/api.ts', srcRoot)).toBe(false)
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
  // Drive the real hook with the same kind of absolute ids Vite passes, so the
  // predicate and the emitted shim path are exercised together against the
  // plugin's actual base rather than a base the test chose.
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
    // scripts/api is in SKIP_WARNING_FILES.
    expect(asset.source).not.toContain('console.warn')
    expect(result?.code).toContain('window.comfyAPI.api.api = api;')
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
