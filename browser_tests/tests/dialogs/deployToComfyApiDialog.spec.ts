import { expect } from '@playwright/test'

import { WorkflowActionsDropdown } from '@e2e/fixtures/components/WorkflowActionsDropdown'
import { deployToComfyApiTest as test } from '@e2e/fixtures/deployToComfyApiFixture'

const MEDIA = 'https://media.comfy.org/website/comfy-api'

test.describe('Deploy to Comfy API', { tag: '@auth' }, () => {
  test('opens the deploy card from the workflow actions menu for a flagged account', async ({
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
    const video = card.getByTestId('deploy-to-comfy-api-video')
    await expect(video).toHaveAttribute(
      'poster',
      `${MEDIA}/comfy-api-poster.jpg`
    )
    await expect(video.locator('source[type="video/mp4"]')).toHaveAttribute(
      'src',
      `${MEDIA}/comfy-api-1280.mp4`
    )
    await expect(video).toHaveJSProperty(
      'currentSrc',
      `${MEDIA}/comfy-api-1280.webm`
    )
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime)
      )
      .toBeGreaterThan(0)
    await expect(
      card.getByRole('link', { name: 'Deploy on Platform' })
    ).toHaveAttribute('target', '_blank')
  })

  test('asks the platform once, and only when the menu first opens', async ({
    comfyPage,
    platformFlag
  }) => {
    const actions = new WorkflowActionsDropdown(comfyPage.page)
    const deployItem = actions.menu.getByRole('menuitem', {
      name: 'Deploy to Comfy API'
    })

    await test.step('makes no request before the menu opens', async () => {
      expect(platformFlag.asked).toBe(0)
    })

    await test.step('asks once when the menu first opens', async () => {
      await actions.trigger.click()
      await expect(deployItem).toBeVisible()
      expect(platformFlag.asked).toBe(1)
    })

    await test.step('closes the menu', async () => {
      await comfyPage.page.keyboard.press('Escape')
      await expect(actions.menu).toBeHidden()
    })

    await test.step('does not ask again when the menu reopens', async () => {
      await actions.trigger.click()
      await expect(deployItem).toBeVisible()
      expect(platformFlag.asked).toBe(1)
    })
  })
})

test.describe('Deploy to Comfy API on Cloud', { tag: '@cloud' }, () => {
  test('never asks the platform, because Cloud reads the flag from PostHog', async ({
    comfyPage,
    platformFlag
  }) => {
    const actions = new WorkflowActionsDropdown(comfyPage.page)

    await actions.trigger.click()
    await expect(actions.menu).toBeVisible()

    expect(platformFlag.asked).toBe(0)
  })
})
