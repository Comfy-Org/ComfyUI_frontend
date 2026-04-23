import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const ICON_CLASS = 'icon-[lucide--star]'
const BUTTON_LABEL = 'Test Action'
const BUTTON_TOOLTIP = 'Test action tooltip'

async function registerTestButton(
  page: Page,
  opts: {
    name?: string
    icon?: string
    label?: string
    tooltip?: string
    onClick?: () => void
  } = {}
): Promise<void> {
  await page.evaluate(
    ({ name, icon, label, tooltip }) => {
      window.app!.registerExtension({
        name,
        actionBarButtons: [{ icon, label, tooltip, onClick: () => {} }]
      })
    },
    {
      name: opts.name ?? 'TestActionBarButton',
      icon: opts.icon ?? ICON_CLASS,
      label: opts.label ?? BUTTON_LABEL,
      tooltip: opts.tooltip ?? BUTTON_TOOLTIP
    }
  )
}

test.describe('ActionBar Buttons', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setup()
  })

  test.describe('Empty state', () => {
    test('container is hidden when no extension registers buttons', async ({
      comfyPage
    }) => {
      await expect(
        comfyPage.page.getByTestId(TestIds.topbar.actionBarButtons)
      ).toBeHidden()
    })
  })

  test.describe('Button rendering', () => {
    test('registered button is visible with correct label', async ({
      comfyPage
    }) => {
      await registerTestButton(comfyPage.page)
      const container = comfyPage.page.getByTestId(
        TestIds.topbar.actionBarButtons
      )
      await expect(container).toBeVisible()
      await expect(
        container.getByRole('button', { name: BUTTON_TOOLTIP })
      ).toBeVisible()
      await expect(container.getByText(BUTTON_LABEL)).toBeVisible()
    })

    test('button icon is rendered', async ({ comfyPage }) => {
      await registerTestButton(comfyPage.page)
      const icon = comfyPage.page
        .getByTestId(TestIds.topbar.actionBarButtons)
        .getByRole('button', { name: BUTTON_TOOLTIP })
        .locator('i')
      await expect(icon).toHaveClass(ICON_CLASS)
    })

    test('multiple registered buttons all appear', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window.app!.registerExtension({
          name: 'TestActionBarButtons',
          actionBarButtons: [
            {
              icon: 'icon-[lucide--star]',
              label: 'First',
              tooltip: 'First action',
              onClick: () => {}
            },
            {
              icon: 'icon-[lucide--heart]',
              label: 'Second',
              tooltip: 'Second action',
              onClick: () => {}
            }
          ]
        })
      })

      const container = comfyPage.page.getByTestId(
        TestIds.topbar.actionBarButtons
      )
      await expect(
        container.getByRole('button', { name: 'First action' })
      ).toBeVisible()
      await expect(
        container.getByRole('button', { name: 'Second action' })
      ).toBeVisible()
    })
  })

  test.describe('Click handler', () => {
    test('clicking a button fires its onClick handler', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(
        ({ icon, label, tooltip }) => {
          ;(
            window as typeof window & { __testClicked: boolean }
          ).__testClicked = false
          window.app!.registerExtension({
            name: 'TestActionBarButton',
            actionBarButtons: [
              {
                icon,
                label,
                tooltip,
                onClick: () => {
                  ;(
                    window as typeof window & { __testClicked: boolean }
                  ).__testClicked = true
                }
              }
            ]
          })
        },
        { icon: ICON_CLASS, label: BUTTON_LABEL, tooltip: BUTTON_TOOLTIP }
      )

      const button = comfyPage.page
        .getByTestId(TestIds.topbar.actionBarButtons)
        .getByRole('button', { name: BUTTON_TOOLTIP })
      await button.click()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () =>
              (window as typeof window & { __testClicked: boolean })
                .__testClicked
          )
        )
        .toBe(true)
    })
  })

  test.describe('Mobile layout', { tag: ['@mobile'] }, () => {
    test('button label is hidden on mobile viewport', async ({ comfyPage }) => {
      await registerTestButton(comfyPage.page)
      const container = comfyPage.page.getByTestId(
        TestIds.topbar.actionBarButtons
      )
      await expect(container).toBeVisible()
      await expect(container.getByText(BUTTON_LABEL)).toBeHidden()
    })
  })
})
