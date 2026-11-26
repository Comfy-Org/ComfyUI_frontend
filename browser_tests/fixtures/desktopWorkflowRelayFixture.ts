import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

import { expect } from '@playwright/test'

import type { DesktopWorkflowHandoff } from '@/platform/openOnCloud/desktopWorkflowHandoff'
import { liveOpenOnCloudLoginFixture as base } from '@e2e/fixtures/liveOpenOnCloudFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

export const desktopWorkflowRelayFixture = base.extend<{
  relayState: 'valid' | 'missing' | 'expired'
  relayTransfer: { url: string; fileUrl: string }
}>({
  relayState: ['valid', { option: true }],
  relayTransfer: async (
    { cloudOrigin, comfyPage, request, relayState },
    use
  ) => {
    const localOrigin = new URL(comfyPage.url)
    if (
      localOrigin.protocol !== 'http:' ||
      localOrigin.hostname !== 'localhost'
    ) {
      throw new Error(
        'Desktop relay test data requires an HTTP localhost editor'
      )
    }
    const nonce = randomUUID()
    const file = `open-on-cloud/${nonce}.json`
    const fileUrl = new URL(
      `/api/userdata/${encodeURIComponent(file)}`,
      localOrigin
    ).href
    const expiresAt =
      Date.now() + (relayState === 'expired' ? -60_000 : 10 * 60_000)
    const workflow: unknown = JSON.parse(
      await readFile(assetPath('openOnCloud/01-runnable-on-cloud.json'), 'utf8')
    )
    const handoff = {
      filename: 'desktop-relay-workflow.json',
      workflow,
      expiresAt
    } satisfies DesktopWorkflowHandoff
    const destination = new URL(cloudOrigin)
    destination.searchParams.set('from_local', nonce)
    destination.hash = `desktop_workflow=${gzipSync(
      JSON.stringify(handoff)
    ).toString('base64')}`

    if (relayState !== 'missing') {
      const stored = await request.post(`${fileUrl}?overwrite=false`, {
        headers: { 'Comfy-User': 'default' },
        data: { destination: destination.href, expiresAt }
      })
      expect(stored.status()).toBe(200)
    }

    const relay = new URL(localOrigin)
    relay.searchParams.set('desktop_workflow', nonce)
    relay.searchParams.set('user', 'default')
    try {
      await use({ url: relay.href, fileUrl })
    } finally {
      const removed = await request.delete(fileUrl, {
        headers: { 'Comfy-User': 'default' }
      })
      expect([204, 404]).toContain(removed.status())
    }
  }
})
