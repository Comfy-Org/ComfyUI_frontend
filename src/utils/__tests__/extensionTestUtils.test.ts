import { describe, expect, it, vi } from 'vitest'

import { createExtensionCapture } from './extensionTestUtils'

describe('createExtensionCapture', () => {
  it('finds registrations by name independently of mock call history', () => {
    const capture = createExtensionCapture()
    const register = vi.fn(capture.registerExtension)
    const first = { name: 'Comfy.First', setup: vi.fn() }
    const second = { name: 'Comfy.Second', setup: vi.fn() }
    register(first)
    register(second)
    register.mockReset()

    expect(capture.getExtension('Comfy.Second')).toBe(second)
    expect(capture.getExtension('Comfy.First')).toBe(first)
    expect(() => capture.getExtension('Comfy.Missing')).toThrow(
      'Extension Comfy.Missing was not registered'
    )
  })

  it('isolates captures even when suites register the same extension name', () => {
    const first = createExtensionCapture()
    const second = createExtensionCapture()
    const original = { name: 'Comfy.Shared' }
    first.registerExtension(original)
    expect(() => second.getExtension('Comfy.Shared')).toThrow(
      'Extension Comfy.Shared was not registered'
    )
    const replacement = { name: 'Comfy.Shared' }
    second.registerExtension(replacement)

    expect(first.getExtension('Comfy.Shared')).toBe(original)
    expect(second.getExtension('Comfy.Shared')).toBe(replacement)
  })
})
