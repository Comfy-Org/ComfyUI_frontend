import { expect } from '@playwright/test'
import type { Response } from '@playwright/test'

import { liveOpenOnCloudLoginFixture as base } from '@e2e/fixtures/liveOpenOnCloudFixture'

export const liveLocalDeploymentAgentFixture = base.extend<{
  signedInAgent: void
  agentMessageUrl: string
}>({
  liveNetworkOrigins: async ({ liveNetworkOrigins }, use) => {
    await use([
      ...liveNetworkOrigins,
      'https://accounts.google.com',
      'https://oauth2.googleapis.com',
      'https://accounts.youtube.com',
      'https://stagingcloud.comfy.org',
      'https://stagingplatform.comfy.org',
      'https://lh3.googleusercontent.com'
    ])
  },
  agentMessageUrl: async ({ baseURL }, use) => {
    const editor = new URL(baseURL ?? '')
    if (editor.protocol !== 'http:' || editor.hostname !== 'localhost') {
      throw new Error(
        'The live local agent suite requires an HTTP localhost editor'
      )
    }
    await use(new URL('/api/agent/threads/new/messages', editor).href)
  },
  signedInAgent: [
    async ({ comfyPage, agentMessageUrl }, use) => {
      const interactive = process.env.OPEN_ON_CLOUD_INTERACTIVE_LOGIN === '1'
      if (!process.env.OPEN_ON_CLOUD_AUTH_STATE && !interactive) {
        throw new Error(
          'Supply real OPEN_ON_CLOUD_AUTH_STATE or set OPEN_ON_CLOUD_INTERACTIVE_LOGIN=1 to sign in normally and handle agent consent'
        )
      }
      expect(new URL(agentMessageUrl).origin).toBe(
        new URL(comfyPage.url).origin
      )
      const signedInUser = comfyPage.page.getByTestId('current-user-button')
      if (interactive && !(await signedInUser.isVisible())) {
        await comfyPage.page.getByTestId('login-button').click()
      }
      await expect(
        signedInUser,
        'Complete normal sign-in in the headed browser; real account authentication is required'
      ).toBeVisible({ timeout: interactive ? 180_000 : 30_000 })
      const newChat = comfyPage.page.getByRole('button', {
        name: 'New chat',
        exact: true
      })
      if (await newChat.isVisible()) await newChat.click()

      const acceptedTurns = new Set<Response>()
      const trackAcceptedTurn = (response: Response) => {
        if (
          response.url() === agentMessageUrl &&
          response.request().method() === 'POST' &&
          response.status() === 202
        ) {
          acceptedTurns.add(response)
        }
      }
      comfyPage.page.on('response', trackAcceptedTurn)
      try {
        await use()
      } finally {
        comfyPage.page.off('response', trackAcceptedTurn)
        const stop = comfyPage.page
          .getByTestId('agent-composer')
          .getByRole('button', { name: 'Stop', exact: true })
        if (acceptedTurns.size > 0 && (await stop.isVisible())) {
          await stop.click()
          await expect(stop).toBeHidden()
        }
      }
    },
    { auto: true, timeout: 210_000 }
  ]
})
