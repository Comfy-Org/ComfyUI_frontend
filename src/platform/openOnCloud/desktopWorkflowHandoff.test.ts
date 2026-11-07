import { assert, describe, expect, it, vi } from 'vitest'

import {
  captureDesktopWorkflowHandoff,
  DESKTOP_HANDOFF_HASH,
  DESKTOP_HANDOFF_LIFETIME_MS,
  desktopWorkflowUrl,
  takeDesktopWorkflowHandoff
} from '@/platform/openOnCloud/desktopWorkflowHandoff'
import { defaultGraph } from '@/scripts/defaultGraph'

describe('Desktop workflow transfer through the external browser', () => {
  it('refuses an oversized payload so Desktop can offer its file fallback', async () => {
    expect(
      await desktopWorkflowUrl(crypto.randomUUID(), {
        filename: 'oversized',
        workflow: { data: 'x'.repeat(2 * 1024 * 1024) },
        expiresAt: Date.now() + DESKTOP_HANDOFF_LIFETIME_MS
      })
    ).toBeUndefined()
  })

  it('keeps a workflow through sign-in, strips its data from the URL and consumes it once', async () => {
    const nonce = crypto.randomUUID()
    const handoff = {
      filename: 'my-workflow',
      workflow: defaultGraph,
      expiresAt: Date.now() + DESKTOP_HANDOFF_LIFETIME_MS
    }
    const destination = await desktopWorkflowUrl(nonce, handoff)
    assert.isDefined(destination)
    const url = new URL(destination)
    const replace = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {})

    const captured = await captureDesktopWorkflowHandoff(url)

    expect(captured).toBe(true)
    expect(replace).toHaveBeenCalledWith(
      null,
      '',
      expect.not.stringContaining(DESKTOP_HANDOFF_HASH)
    )
    expect(takeDesktopWorkflowHandoff(nonce)).toEqual(handoff)
    expect(takeDesktopWorkflowHandoff(nonce)).toBeUndefined()
  })

  it('does not import a workflow after the ten-minute transfer expires', async () => {
    const nonce = crypto.randomUUID()
    const destination = await desktopWorkflowUrl(nonce, {
      filename: 'expired-workflow',
      workflow: defaultGraph,
      expiresAt: Date.now() + DESKTOP_HANDOFF_LIFETIME_MS
    })
    assert.isDefined(destination)
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
    await captureDesktopWorkflowHandoff(new URL(destination))

    await vi.advanceTimersByTimeAsync(DESKTOP_HANDOFF_LIFETIME_MS + 1)

    expect(takeDesktopWorkflowHandoff(nonce)).toBeUndefined()
  })

  it('removes malformed workflow data without retaining it', async () => {
    const nonce = crypto.randomUUID()
    const url = new URL(window.location.href)
    url.searchParams.set('from_local', nonce)
    url.hash = `${DESKTOP_HANDOFF_HASH}not-valid-gzip`
    const replace = vi.spyOn(window.history, 'replaceState')

    expect(await captureDesktopWorkflowHandoff(url)).toBe(false)

    expect(replace).toHaveBeenCalledOnce()
    expect(takeDesktopWorkflowHandoff(nonce)).toBeUndefined()
  })
})
