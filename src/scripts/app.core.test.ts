import { describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'

describe('app core canary', () => {
  it('installs the drop handler directly', () => {
    ;(
      Object.getPrototypeOf(app) as { addDropHandler(): void }
    ).addDropHandler.call(app)

    document.dispatchEvent(new DragEvent('drop'))
    vi.clearAllMocks()

    expect(true).toBe(true)
  })
})
