import { describe, expect, it } from 'vitest'

import {
  DESKTOP_HANDOFF_LIFETIME_MS,
  desktopWorkflowUrl
} from '@/platform/openOnCloud/desktopWorkflowHandoff'

describe('Desktop workflow transfer through the external browser', () => {
  it('refuses an oversized payload so Desktop can offer its file fallback', async () => {
    expect(
      await desktopWorkflowUrl(crypto.randomUUID(), {
        filename: 'oversized',
        workflow: { data: 'x'.repeat(8 * 1024 * 1024) },
        expiresAt: Date.now() + DESKTOP_HANDOFF_LIFETIME_MS
      })
    ).toBeUndefined()
  })
})
