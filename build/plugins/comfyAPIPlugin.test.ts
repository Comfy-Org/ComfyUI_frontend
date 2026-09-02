import path from 'path'
import { describe, expect, it } from 'vitest'

import { isLegacyFile } from './comfyAPIPlugin'

describe('isLegacyFile', () => {
  const root = process.cwd()

  it("matches this package's own legacy scripts/", () => {
    expect(isLegacyFile(path.join(root, 'src/scripts/api.ts'))).toBe(true)
  })

  it("matches this package's own legacy extensions/core/", () => {
    expect(
      isLegacyFile(path.join(root, 'src/extensions/core/groupNode.ts'))
    ).toBe(true)
  })

  it("does not match another package's src/scripts (e.g. apps/website)", () => {
    // Regression: apps/website/src/scripts/customerio.ts previously matched
    // via a bare "src/scripts" substring check, breaking storybook-build
    // (RolldownError: relative fileName for the emitted shim asset).
    expect(
      isLegacyFile(path.join(root, 'apps/website/src/scripts/customerio.ts'))
    ).toBe(false)
  })

  it("does not match another package's src/extensions/core", () => {
    expect(
      isLegacyFile(
        path.join(root, 'apps/website/src/extensions/core/whatever.ts')
      )
    ).toBe(false)
  })

  it('does not match non-.ts files', () => {
    expect(isLegacyFile(path.join(root, 'src/scripts/api.vue'))).toBe(false)
  })

  it('does not match src/ files outside scripts/ or extensions/core/', () => {
    expect(isLegacyFile(path.join(root, 'src/components/App.ts'))).toBe(false)
  })

  it('does not match files entirely outside src/', () => {
    expect(isLegacyFile(path.join(root, 'build/plugins/other.ts'))).toBe(false)
  })
})
