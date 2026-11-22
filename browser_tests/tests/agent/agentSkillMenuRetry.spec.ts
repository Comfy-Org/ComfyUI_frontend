import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentSkillMenuRetryTest as test,
  SKILL_NAME
} from '@e2e/fixtures/agentSkillMenuRetryFixture'

test.describe(
  'Agent skill menu recovery',
  {
    tag: ['@cloud', '@agent', '@ui'],
    annotation: {
      type: 'issue',
      description: 'https://linear.app/comfyorg/issue/FRONT-4314'
    }
  },
  () => {
    test('keeps a failed catalog retryable and shows the recovered skill', async ({
      page,
      agentPanel,
      skillRequests
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('/')

      const menu = page.getByRole('menu', {
        name: enMessages.agent.skills,
        exact: true
      })
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('status')).toContainText(
        enMessages.agent.skillsLoadError
      )
      const retry = menu.getByRole('button', {
        name: enMessages.g.retry,
        exact: true
      })
      await expect(retry).toBeVisible()
      expect(skillRequests).toHaveLength(1)

      await agentPanel.composer.press('Escape')
      await agentPanel.composer.press('Control+A')
      await agentPanel.composer.press('Backspace')
      await expect(agentPanel.composer).toHaveText('')
      await agentPanel.composer.pressSequentially('/')

      await expect(menu).toBeVisible()
      await expect.poll(() => skillRequests.length).toBe(2)
      await expect(
        menu.getByRole('menuitem', { name: SKILL_NAME, exact: true })
      ).toBeVisible()
    })
  }
)
