import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const REFERENCE_MENU_ID = 'agent-reference-menu'

test.describe(
  'Agent composer reference-popup ARIA contract (#16596)',
  { tag: '@cloud' },
  () => {
    test('declares the popup with attributes the textbox role supports', async ({
      agentPanel
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await expect(agentPanel.composer).toHaveRole('textbox')
      await expect(agentPanel.composer).toHaveAttribute(
        'aria-multiline',
        'true'
      )
      await expect(agentPanel.composer).toHaveAttribute('aria-haspopup', 'menu')
      await expect(agentPanel.composer).not.toHaveAttribute('aria-expanded')
    })

    test('leaves no dangling popup reference while the reference menu is closed', async ({
      agentPanel
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await expect(agentPanel.root.getByTestId(REFERENCE_MENU_ID)).toBeHidden()
      await expect(agentPanel.composer).not.toHaveAttribute('aria-controls')
      await expect(agentPanel.composer).not.toHaveAttribute(
        'aria-activedescendant'
      )
    })

    test('points at the reference menu only while that menu is on the page', async ({
      agentPanel,
      page
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('@')

      const menu = agentPanel.root.getByTestId(REFERENCE_MENU_ID)
      await expect(menu).toBeVisible()
      await expect(menu).toHaveRole('menu')
      await expect(agentPanel.composer).toHaveAttribute(
        'aria-controls',
        REFERENCE_MENU_ID
      )
      await expect(page.locator(`#${REFERENCE_MENU_ID}`)).toBeVisible()
      await expect(agentPanel.composer).not.toHaveAttribute('aria-expanded')

      await agentPanel.composer.press('Escape')

      await expect(menu).toBeHidden()
      await expect(agentPanel.composer).not.toHaveAttribute('aria-controls')
    })

    test('keeps the highlighted reference reachable for a screen reader', async ({
      agentPanel
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.composer.fill('@')
      await expect(agentPanel.root.getByTestId(REFERENCE_MENU_ID)).toBeVisible()

      await agentPanel.composer.press('ArrowDown')

      await expect(
        agentPanel.root
          .getByRole('menuitem')
          .and(agentPanel.root.locator('[data-active="true"]'))
      ).toBeVisible()
      await expect
        .poll(() =>
          agentPanel.composer.evaluate((element) => {
            const id = element.getAttribute('aria-activedescendant')
            const target = id ? document.getElementById(id) : null
            if (!target) return 'unresolved'
            return target.getAttribute('role') ?? 'no-role'
          })
        )
        .toBe('menuitem')
    })
  }
)
