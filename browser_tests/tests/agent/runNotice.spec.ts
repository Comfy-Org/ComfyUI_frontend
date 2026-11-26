import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { restoredTargetlessAgentThreadTest as test } from '@e2e/fixtures/agentPanelFixture'

test.describe(
  'PM-1236 targetless run-permissions notice',
  {
    tag: ['@cloud', '@agent'],
    annotation: {
      type: 'source',
      description:
        'https://linear.app/comfyorg/issue/PM-1236/clarify-and-defer-the-run-permissions-notice'
    }
  },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.install()
    })

    test('appears only after the user focuses the composer', async ({
      agentComposerPanel,
      page
    }, testInfo) => {
      const notice = agentComposerPanel.root
        .getByRole('note')
        .filter({ hasText: enMessages.agent.runNotice })

      await expect(
        notice,
        'no notice synchronously after the targetless panel opens'
      ).toHaveCount(0)

      await test.step('idle 1500ms past the 500ms deferral without touching the composer', async () => {
        await page.clock.runFor(1_500)
      })

      await expect(
        notice,
        'elapsed time alone never reveals the notice'
      ).toHaveCount(0)

      await testInfo.attach('before-composer-focus', {
        body: await agentComposerPanel.root.screenshot(),
        contentType: 'image/png'
      })

      await agentComposerPanel.composer.focus()
      await expect(notice).toBeVisible()
      await expect(notice).toHaveText(enMessages.agent.runNotice)
      await testInfo.attach('after-composer-focus', {
        body: await agentComposerPanel.root.screenshot(),
        contentType: 'image/png'
      })
    })
  }
)
