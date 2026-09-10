import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe('Agent consent gate', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ agentConsentAccepted: false })

  test('dismisses without activation and persists acceptance before opening', async ({
    comfyPage,
    agentConsentWrites
  }) => {
    const page = comfyPage.page
    const openButton = page.getByRole('button', {
      name: enMessages.agent.askComfyAgent
    })
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    const panel = page.locator('#agent-panel-root')

    await openButton.click()
    await expect(dialog).toBeVisible()
    await expect(panel).toHaveCount(0)

    await dialog
      .getByRole('button', { name: enMessages.agent.consent.reject })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(panel).toHaveCount(0)
    expect(agentConsentWrites).toHaveLength(0)

    await openButton.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(panel).toHaveCount(0)

    await openButton.click()
    await expect(dialog).toBeVisible()
    await page.getByTestId('dialog-overlay').click({ position: { x: 1, y: 1 } })
    await expect(dialog).toHaveCount(0)
    await expect(panel).toHaveCount(0)

    await openButton.click()
    await dialog
      .getByRole('button', { name: enMessages.agent.consent.accept })
      .click()
    await expect.poll(() => agentConsentWrites).toEqual([true])
    await expect(dialog).toHaveCount(0)
    await expect(panel).toBeVisible()

    await expect(openButton).toHaveCount(0)
    await panel
      .getByRole('button', { name: enMessages.agent.close, exact: true })
      .click()
    await expect(panel).toHaveCount(0)
    await openButton.click()
    await expect(dialog).toHaveCount(0)
    await expect(panel).toBeVisible()

    await comfyPage.workflow.reloadAndWaitForApp()
    await expect(dialog).toHaveCount(0)
    await expect(panel).toBeVisible()
  })

  test.describe('with a restored open intent', () => {
    test.use({ agentPanelInitiallyOpen: true })

    test('keeps the panel hidden until the user accepts', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const panel = page.locator('#agent-panel-root')

      await expect(panel).toHaveCount(0)
      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      await expect(
        page.getByRole('dialog', { name: enMessages.agent.consent.title })
      ).toBeVisible()
      await expect(panel).toHaveCount(0)
    })
  })

  test.describe('when persistence fails', () => {
    test.use({ agentConsentSaveStatus: 500 })

    test('keeps the card retryable and the panel closed', async ({
      comfyPage,
      agentConsentWrites
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.accept })
        .click()

      await expect.poll(() => agentConsentWrites).toEqual([true])
      await expect(dialog.getByRole('alert')).toHaveText(
        enMessages.agent.consent.saveError
      )
      await expect(
        dialog.getByRole('button', { name: enMessages.agent.consent.accept })
      ).toBeEnabled()
      await expect(page.locator('#agent-panel-root')).toHaveCount(0)
    })
  })

  test.describe('in a narrow viewport', () => {
    test.use({ viewport: { width: 430, height: 900 } })

    test('uses square media and aligns keyboard order with action order', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()

      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const video = dialog.locator('video')
      const docs = dialog.getByRole('link', {
        name: enMessages.agent.consent.readDocs
      })
      const accept = dialog.getByRole('button', {
        name: enMessages.agent.consent.accept
      })
      const reject = dialog.getByRole('button', {
        name: enMessages.agent.consent.reject
      })

      await expect
        .poll(async () => {
          const box = await video.boundingBox()
          return box ? Math.abs(box.width - box.height) : undefined
        })
        .toBeLessThanOrEqual(1)
      await expect
        .poll(async () => {
          const [acceptBox, rejectBox] = await Promise.all([
            accept.boundingBox(),
            reject.boundingBox()
          ])
          return acceptBox && rejectBox ? acceptBox.y < rejectBox.y : false
        })
        .toBe(true)

      await docs.focus()
      await expect(docs).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(accept).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(reject).toBeFocused()
    })
  })

  test('keeps actions reachable in a short wide window', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.setViewportSize({ width: 1280, height: 480 })
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    const accept = dialog.getByRole('button', {
      name: enMessages.agent.consent.accept
    })
    const reject = dialog.getByRole('button', {
      name: enMessages.agent.consent.reject
    })
    await accept.scrollIntoViewIfNeeded()
    await expect(accept).toBeInViewport({ ratio: 1 })
    await expect(reject).toBeInViewport({ ratio: 1 })
    await reject.click()
    await expect(dialog).toHaveCount(0)
  })

  test('lets a narrow short window scroll from the heading to the actions', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.setViewportSize({ width: 430, height: 600 })
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    const heading = dialog.getByRole('heading', {
      name: enMessages.agent.consent.title
    })
    const reject = dialog.getByRole('button', {
      name: enMessages.agent.consent.reject
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeInViewport({ ratio: 1 })
    await reject.scrollIntoViewIfNeeded()
    await expect(reject).toBeInViewport({ ratio: 1 })
    await reject.click()
    await expect(dialog).toHaveCount(0)
  })

  test('allows keyboard pause and stops autoplay for reduced motion', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    const video = page
      .getByRole('dialog', { name: enMessages.agent.consent.title })
      .locator('video')
    await expect(video).toHaveAttribute('controls', '')
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(false)
    await video.focus()
    await page.keyboard.press('Space')
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(true)
    await page.keyboard.press('Space')
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(false)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(video).not.toHaveAttribute('autoplay')
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(true)
    await page.keyboard.press('Escape')
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    await expect(video).not.toHaveAttribute('autoplay')
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => element.readyState)
      )
      .toBeGreaterThanOrEqual(2)
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
      .toBe(true)
  })
})
