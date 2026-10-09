import { expect } from '@playwright/test'

import { WorkflowActionsDropdown } from '@e2e/fixtures/components/WorkflowActionsDropdown'
import { deployToComfyApiTest as test } from '@e2e/fixtures/deployToComfyApiFixture'

test.describe('Deploy to Comfy API', () => {
  test('opens the deploy card from the workflow actions menu', async ({
    comfyPage
  }) => {
    const actions = new WorkflowActionsDropdown(comfyPage.page)

    await actions.trigger.click()
    await actions.menu
      .getByRole('menuitem', { name: 'Deploy to Comfy API' })
      .click()

    const card = comfyPage.page
      .getByRole('dialog')
      .getByTestId('deploy-to-comfy-api-card')
    await expect(card).toBeVisible()
    await expect(
      card.getByRole('heading', { name: 'Deploy to Comfy API' })
    ).toBeVisible()
  })

  test('keeps keyboard focus during an async copy and allows a later retry', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const actions = new WorkflowActionsDropdown(page)

    await actions.trigger.click()
    await actions.menu
      .getByRole('menuitem', { name: 'Deploy to Comfy API' })
      .click()

    const button = page
      .getByRole('dialog')
      .getByTestId('deploy-to-comfy-api-agent')
    await expect(button).toBeVisible()

    // Hold the real clipboard-dependent action pending while testing the
    // actual Button component, rather than injecting a synthetic button.
    await page.evaluate(() => {
      const root = document.documentElement
      root.dataset.testClipboardWrites = '0'
      navigator.clipboard.writeText = async () => {
        root.dataset.testClipboardWrites = String(
          Number(root.dataset.testClipboardWrites ?? 0) + 1
        )
        await new Promise<void>((resolve) => {
          window.addEventListener('e2e-release-clipboard-write', () => resolve(), {
            once: true
          })
        })
      }
    })

    const clipboardWrites = () =>
      page.locator('html').getAttribute('data-test-clipboard-writes')

    await button.focus()
    await button.press('Enter')

    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).not.toBeDisabled()
    await expect(button).toBeFocused()
    await expect.poll(clipboardWrites).toBe('1')

    await button.press('Enter')
    await button.press('Space')
    await expect.poll(clipboardWrites).toBe('1')
    await expect(button).toBeFocused()

    await page.evaluate(() => {
      window.dispatchEvent(new Event('e2e-release-clipboard-write'))
    })
    await expect(button).not.toHaveAttribute('aria-busy', 'true')
    await expect(button).not.toHaveAttribute('aria-disabled', 'true')

    await button.press('Enter')
    await expect.poll(clipboardWrites).toBe('2')
    await page.evaluate(() => {
      window.dispatchEvent(new Event('e2e-release-clipboard-write'))
    })
    await expect(button).not.toHaveAttribute('aria-busy', 'true')
  })
})
