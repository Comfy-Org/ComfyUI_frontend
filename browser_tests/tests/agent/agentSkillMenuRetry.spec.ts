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
      skillRequests,
      skillCatalog
    }) => {
      await agentPanel.open()
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

      const askedWhileFailing = skillRequests.length
      skillCatalog.healthy = true
      await retry.click()

      await expect(
        menu.getByRole('menuitem', { name: SKILL_NAME, exact: true })
      ).toBeVisible()
      await expect(retry).toBeHidden()
      expect(skillRequests.length).toBeGreaterThan(askedWhileFailing)
    })

    test.describe('when skills are off for the account', () => {
      test.use({ skillFailureStatus: 404 })

      test('says skills are unavailable after a 404 and lists them when the menu reopens', async ({
        page,
        agentPanel,
        skillCatalog
      }) => {
        await agentPanel.open()
        await agentPanel.composer.fill('/')

        const menu = page.getByRole('menu', {
          name: enMessages.agent.skills,
          exact: true
        })
        await expect(menu.getByRole('status')).toContainText(
          enMessages.agent.skillsUnavailable
        )
        await expect(
          menu.getByRole('button', { name: enMessages.g.retry, exact: true })
        ).toBeHidden()

        skillCatalog.healthy = true
        await agentPanel.composer.fill('')
        await agentPanel.composer.fill('/')

        await expect(
          menu.getByRole('menuitem', { name: SKILL_NAME, exact: true })
        ).toBeVisible()
      })
    })
  }
)
