import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const FIRST_SESSION_DEFERRED_STORAGE_KEY =
  'Comfy.AgentPanel.firstSessionDeferred'

const firstSessionDeferralRecorded = (page: Page) =>
  page.evaluate((storageKey) => {
    const scope = localStorage.getItem('Comfy.userId') ?? 'default'
    return localStorage.getItem(`${storageKey}.${scope}`)
  }, FIRST_SESSION_DEFERRED_STORAGE_KEY)

test.describe(
  "A new local user's first session keeps the Agent quiet",
  {
    tag: ['@agent', '@ui'],
    annotation: {
      type: 'issue',
      description:
        'https://linear.app/comfyorg/issue/PM-2647/desktop-agent-defer-the-agent-pop-up-and-panel-open-to-the-second'
    }
  },
  () => {
    test.use({
      agentConsentAccepted: false,
      initialSettings: { 'Comfy.TutorialCompleted': false }
    })

    test('shows only the templates on the first launch, then opens the Agent on the next', async ({
      agentPanel,
      comfyPage
    }) => {
      test.slow()
      const page = comfyPage.page
      const deferralRecorded = () => firstSessionDeferralRecorded(page)

      await test.step('The first launch shows the templates and no Agent', async () => {
        await expect(comfyPage.templates.content).toBeVisible()
        await expect
          .poll(
            async () =>
              (await deferralRecorded()) !== null ||
              (await agentPanel.root.count()) > 0,
            { message: 'the Agent settles its startup decision' }
          )
          .toBe(true)
        await expect(agentPanel.root).toHaveCount(0)
        await expect(agentPanel.consentDialog).toHaveCount(0)
      })

      await test.step('Closing the templates does not bring the Agent up', async () => {
        await page.keyboard.press('Escape')
        await expect(comfyPage.templates.content).toBeHidden()
        await expect(agentPanel.openButton).toBeVisible()
        await expect(agentPanel.openButton).toHaveAttribute(
          'aria-pressed',
          'false'
        )
        await expect(agentPanel.root).toHaveCount(0)
        await expect(agentPanel.consentDialog).toHaveCount(0)
      })

      await test.step('The next launch opens the Agent as before', async () => {
        await comfyPage.workflow.reloadAndWaitForApp()
        await expect(agentPanel.root).toBeVisible()
      })
    })
  }
)

test.describe(
  "The Agent button on a new local user's first session",
  { tag: ['@agent', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      initialSettings: { 'Comfy.TutorialCompleted': false }
    })

    test('still asks for consent when the user opens the Agent', async ({
      agentPanel,
      comfyPage
    }) => {
      await expect(comfyPage.templates.content).toBeVisible()
      await comfyPage.page.keyboard.press('Escape')
      await expect(comfyPage.templates.content).toBeHidden()
      await expect(agentPanel.consentDialog).toHaveCount(0)

      await agentPanel.openButton.click()
      await expect(agentPanel.consentDialog).toBeVisible()
    })
  }
)

test.describe(
  "A panel left open on this origin before a new local user's first session",
  { tag: ['@agent', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      agentPanelInitiallyOpen: true,
      initialLocalStorage: { 'Comfy.AgentPanel.activationVisits': '2' },
      initialSettings: { 'Comfy.TutorialCompleted': false }
    })

    test('stays hidden on the first launch and is restored on the next', async ({
      agentPanel,
      comfyPage
    }) => {
      const page = comfyPage.page

      await test.step('The first launch keeps the panel hidden', async () => {
        await expect(comfyPage.templates.content).toBeVisible()
        await expect
          .poll(() => firstSessionDeferralRecorded(page))
          .not.toBeNull()
        await page.keyboard.press('Escape')
        await expect(comfyPage.templates.content).toBeHidden()
        await expect(agentPanel.root).toHaveCount(0)
      })

      await test.step('The next launch restores the panel', async () => {
        await comfyPage.workflow.reloadAndWaitForApp()
        await expect(agentPanel.root).toBeVisible()
      })
    })
  }
)
