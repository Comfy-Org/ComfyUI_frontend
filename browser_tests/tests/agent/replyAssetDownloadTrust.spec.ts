import { expect } from '@playwright/test'
import type { AgentMessage } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe(
  'Agent reply asset download trust boundary',
  {
    tag: ['@cloud', '@ui']
  },
  () => {
    // Keyed by asset rather than collected in arrival order: the three fetches
    // race, so an index-based record silently changes which request each
    // assertion is checking.
    let cookieByAsset: Map<string, string | null>
    let downloads: string[]

    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      await bootAgentApp(page, agentFlagEnabled)

      const threadId = '4efb615c-b3fd-4cdc-8767-38c2b44d2cec'
      const urls = [
        '/api/view?filename=trusted.png',
        '/api/system_stats?filename=untrusted.png',
        'https://evil.example/api/view?filename=hostile.png'
      ]
      const messages: AgentMessage[] = [
        {
          id: 'reply',
          thread_id: threadId,
          turn_id: 'download-turn',
          seq: 1,
          role: 'assistant',
          status: 'complete',
          content: { text: urls.map((url) => `![Asset](${url})`).join('\n\n') }
        }
      ]
      await page.route(`**/api/agent/threads/${threadId}/messages`, (route) =>
        route.fulfill(jsonRoute(messages))
      )
      await page.addInitScript((id) => {
        localStorage.setItem('Comfy.Agent.ThreadId', id)
      }, threadId)
      cookieByAsset = new Map<string, string | null>()
      downloads = []
      page.on('download', (download) =>
        downloads.push(download.suggestedFilename())
      )
      await page.context().addCookies([
        {
          name: 'session',
          value: 'test-session',
          url: new URL(page.url()).origin
        }
      ])
      await page.route(
        /\/api\/(view|system_stats)\?filename=(trusted|untrusted|hostile)\.png/,
        async (route) => {
          if (route.request().resourceType() === 'fetch') {
            const asset = new URL(route.request().url()).searchParams.get(
              'filename'
            )
            if (asset) {
              cookieByAsset.set(
                asset,
                await route.request().headerValue('cookie')
              )
            }
          }
          await route.fulfill({ body: 'asset', contentType: 'image/png' })
        }
      )
      await page.reload()
    })

    test('keeps authentication on the trusted view route only', async ({
      page
    }) => {
      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
        .click()
      const downloadButton = page.getByRole('button', {
        name: enMessages.agent.downloadAssets,
        exact: true
      })
      await expect(downloadButton).toBeVisible()
      await downloadButton.click()

      // All three assets download; the order they settle in is a race between
      // three concurrent fetches and is not part of the contract.
      await expect
        .poll(() => [...downloads].sort())
        .toEqual(['hostile.png', 'trusted.png', 'untrusted.png'])

      expect([...cookieByAsset.keys()].sort()).toEqual([
        'hostile.png',
        'trusted.png',
        'untrusted.png'
      ])
      // The session travels to the trusted view route and nowhere else.
      expect(cookieByAsset.get('trusted.png')).toContain('session=test-session')
      expect(cookieByAsset.get('untrusted.png')).toBeNull()
      expect(cookieByAsset.get('hostile.png')).toBeNull()
    })
  }
)
