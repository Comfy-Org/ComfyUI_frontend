import type { DesktopLoginCodeRedeemResponse } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import frMessages from '@/locales/fr/main.json' with { type: 'json' }

import { agentConsentTest as test } from '@e2e/fixtures/agentConsentFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

async function requestConsentFromOpenPanel(page: Page): Promise<void> {
  const openButton = page.getByRole('button', {
    name: enMessages.agent.entryButton,
    exact: true
  })
  const panel = page.locator('#agent-panel-root')

  await expect(panel).toBeVisible()
  await expect(openButton).toHaveAttribute('aria-pressed', 'true')
  await new AgentPanel(page).close()
  await openButton.click()
}

test.describe('Manual agent consent gate', { tag: ['@cloud', '@ui'] }, () => {
  test.use({
    agentConsentAccepted: false,
    initialLocalStorage: {
      'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal': 'true'
    }
  })

  test('dismisses without consent and persists acceptance before reopening', async ({
    comfyPage,
    agentConsentSave,
    agentConsentWrites
  }) => {
    const page = comfyPage.page
    const openButton = page.getByRole('button', {
      name: enMessages.agent.entryButton,
      exact: true
    })
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    const panel = page.locator('#agent-panel-root')

    await test.step('Activation opens Agent before consent; Skip leaves it closed without saving', async () => {
      await requestConsentFromOpenPanel(page)
      await expect(dialog).toBeVisible()
      await expect(panel).toHaveCount(0)

      await dialog
        .getByRole('button', { name: enMessages.agent.consent.reject })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(panel).toHaveCount(0)
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Escape leaves Agent closed without saving consent', async () => {
      await openButton.click()
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(panel).toHaveCount(0)
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Clicking outside leaves Agent closed without saving consent', async () => {
      await openButton.click()
      await expect(dialog).toBeVisible()
      await page
        .getByTestId('dialog-overlay')
        .click({ position: { x: 1, y: 1 } })
      await expect(dialog).toHaveCount(0)
      await expect(panel).toHaveCount(0)
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Accept saves consent before opening Agent', async () => {
      let releaseSave = () => {}
      agentConsentSave.pending = new Promise<void>((resolve) => {
        releaseSave = resolve
      })
      await openButton.click()
      const accept = dialog.getByRole('button', {
        name: enMessages.agent.consent.accept
      })
      try {
        await accept.click()
        await expect.poll(() => agentConsentWrites).toEqual([true])
        await expect(dialog).toBeVisible()
        await expect(accept).toBeDisabled()
        await expect(panel).toHaveCount(0)
      } finally {
        releaseSave()
      }
      await expect(dialog).toHaveCount(0)
      await expect(panel).toBeVisible()
    })

    await test.step('Agent button closes and reopens the panel without another consent prompt', async () => {
      await expect(openButton).toBeVisible()
      await expect(openButton).toHaveAttribute('aria-pressed', 'true')
      await openButton.click()
      await expect(panel).toHaveCount(0)
      await expect(openButton).toHaveAttribute('aria-pressed', 'false')
      await openButton.click()
      await expect(dialog).toHaveCount(0)
      await expect(panel).toBeVisible()
      await expect(openButton).toHaveAttribute('aria-pressed', 'true')
    })

    await test.step('Saved consent survives reload', async () => {
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect(dialog).toHaveCount(0)
      await expect(panel).toBeVisible()
    })
  })

  test.describe('with a restored open intent', () => {
    test.use({ agentPanelInitiallyOpen: true })

    test('keeps the activated panel visible until consent is requested', async ({
      comfyPage,
      agentPanelFlash
    }) => {
      const page = comfyPage.page
      const panel = page.locator('#agent-panel-root')
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await test.step('Restoring open intent renders the panel before consent', async () => {
        await expect(panel).toBeVisible()
        expect(await agentPanelFlash.hasFlashed()).toBe(true)
      })

      await test.step('Explicit acceptance reopens the panel', async () => {
        await requestConsentFromOpenPanel(page)
        await expect(dialog).toBeVisible()
        await expect(panel).toHaveCount(0)
        await dialog
          .getByRole('button', { name: enMessages.agent.consent.accept })
          .click()
        await expect(panel).toBeVisible()
        await expect.poll(() => agentPanelFlash.hasFlashed()).toBe(true)
      })
    })
  })

  test.describe('when persistence fails', () => {
    test('keeps the card retryable and the panel closed', async ({
      comfyPage,
      agentConsentSave,
      agentConsentWrites
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const accept = dialog.getByRole('button', {
        name: enMessages.agent.consent.accept
      })
      const panel = page.locator('#agent-panel-root')

      await test.step('A failed save leaves the panel closed and allows retry', async () => {
        agentConsentSave.status = 500
        await requestConsentFromOpenPanel(page)
        await accept.click()

        await expect.poll(() => agentConsentWrites).toEqual([true])
        await expect(dialog.getByRole('alert')).toHaveText(
          enMessages.agent.consent.saveError
        )
        await expect(accept).toBeEnabled()
        await expect(panel).toHaveCount(0)
      })

      await test.step('Retry sends another save and opens the panel after recovery', async () => {
        agentConsentSave.status = 200
        await accept.click()
        await expect.poll(() => agentConsentWrites).toEqual([true, true])
        await expect(dialog).toHaveCount(0)
        await expect(panel).toBeVisible()
      })
    })
  })

  test('keeps the consent card dark in a light app', async ({ comfyPage }) => {
    const page = comfyPage.page

    await test.step('Switch the app to its light palette', async () => {
      await comfyPage.settings.setSetting('Comfy.ColorPalette', 'light')
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)'
      )
    })

    await test.step('Consent keeps its dark surface and readable heading', async () => {
      await requestConsentFromOpenPanel(page)
      await expect(page.getByTestId('agent-consent-card')).toHaveCSS(
        'background-color',
        'rgb(23, 23, 24)'
      )
      await expect(page.getByTestId('agent-consent-card')).toHaveCSS(
        'border-color',
        'rgb(73, 74, 80)'
      )
      await expect(
        page.getByRole('heading', { name: enMessages.agent.consent.title })
      ).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(
        page.getByRole('button', { name: enMessages.agent.consent.accept })
      ).toBeEnabled()
    })
  })

  test.describe('in a narrow viewport', () => {
    test.use({ viewport: { width: 430, height: 900 } })

    test('uses widescreen media and aligns keyboard order with action order', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
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

      await test.step('Narrow layout keeps media widescreen and actions in visual order', async () => {
        await requestConsentFromOpenPanel(page)
        await expect
          .poll(async () => {
            const box = await video.boundingBox()
            return box ? Math.abs(box.width / box.height - 16 / 9) : undefined
          })
          .toBeLessThanOrEqual(0.01)
        await expect
          .poll(async () => {
            const [acceptBox, rejectBox] = await Promise.all([
              accept.boundingBox(),
              reject.boundingBox()
            ])
            return acceptBox && rejectBox
              ? rejectBox.x + rejectBox.width <= acceptBox.x &&
                  rejectBox.y === acceptBox.y
              : false
          })
          .toBe(true)
      })

      await test.step('Keyboard order follows docs, Skip, then Start', async () => {
        await docs.focus()
        await expect(docs).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(reject).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(accept).toBeFocused()
      })
    })
  })

  test.describe('with the light palette', { tag: '@screenshot' }, () => {
    test.use({ initialSettings: { 'Comfy.ColorPalette': 'light' } })

    test('keeps the dark card readable', async ({ comfyPage }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await requestConsentFromOpenPanel(page)
      await expect(dialog).toBeVisible()
      const title = dialog.getByRole('heading', {
        name: enMessages.agent.consent.title
      })
      const colors = await title.evaluate((heading) => {
        let surface: Element | null = heading
        while (
          surface &&
          getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)'
        ) {
          surface = surface.parentElement
        }
        return {
          text: getComputedStyle(heading).color,
          surface: surface ? getComputedStyle(surface).backgroundColor : ''
        }
      })
      expect(colors.text).not.toBe(colors.surface)
      await expectElementScreenshot(dialog, 'agent-consent-light-palette.png', {
        mask: [dialog.locator('video')]
      })
    })
  })

  test.describe('when WebM cannot load', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route(
        'https://media.comfy.org/website/comfy-agent/*.webm',
        (route) => route.fulfill({ status: 404, body: '' })
      )
    })

    test('plays the MP4 fallback', async ({ comfyPage }) => {
      const page = comfyPage.page
      await requestConsentFromOpenPanel(page)

      const video = page.getByTestId('agent-consent-video')
      await expect(video).toHaveJSProperty(
        'currentSrc',
        'https://media.comfy.org/website/comfy-agent/agent-consent-v2-1280.mp4'
      )
      await expect
        .poll(() =>
          video.evaluate((element: HTMLVideoElement) => element.currentTime)
        )
        .toBeGreaterThan(0)
    })

    test.describe('and MP4 cannot load', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.page.route(
          'https://media.comfy.org/website/comfy-agent/*.mp4',
          (route) => route.fulfill({ status: 404, body: '' })
        )
      })

      test('shows the unavailable message and keeps consent actions usable', async ({
        comfyPage
      }) => {
        const page = comfyPage.page
        await requestConsentFromOpenPanel(page)

        const dialog = page.getByRole('dialog', {
          name: enMessages.agent.consent.title
        })
        await expect(
          dialog.getByText(enMessages.agent.consent.videoPlaceholder)
        ).toBeVisible()
        await expect(dialog.getByTestId('agent-consent-video')).toHaveCount(0)
        await expect(
          dialog.getByRole('button', { name: enMessages.agent.consent.accept })
        ).toBeEnabled()
        await dialog
          .getByRole('button', { name: enMessages.agent.consent.reject })
          .click()
        await expect(dialog).toHaveCount(0)
      })
    })
  })

  for (const width of [608, 672]) {
    test.describe(`with long translations at viewport width ${width}`, () => {
      test.use({ viewport: { width, height: 900 } })

      test('keeps the docs link and actions fully visible and in keyboard order', async ({
        comfyPage
      }) => {
        const page = comfyPage.page
        await comfyPage.settings.setSetting('Comfy.Locale', 'fr')
        await requestConsentFromOpenPanel(page)

        const dialog = page.getByRole('dialog', {
          name: frMessages.agent.consent.title
        })
        const docs = dialog.getByRole('link', {
          name: frMessages.agent.consent.readDocs
        })
        const accept = dialog.getByRole('button', {
          name: frMessages.agent.consent.accept
        })
        const reject = dialog.getByRole('button', {
          name: frMessages.agent.consent.reject
        })
        await expect(dialog.getByRole('button')).toHaveText([
          frMessages.agent.consent.reject,
          frMessages.agent.consent.accept
        ])
        await expect(docs).toBeInViewport({ ratio: 1 })
        await expect(reject).toBeInViewport({ ratio: 1 })
        await expect(accept).toBeInViewport({ ratio: 1 })

        await docs.focus()
        await page.keyboard.press('Tab')
        await expect(reject).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(accept).toBeFocused()
      })
    })
  }

  for (const viewport of [
    { width: 1024, height: 760 },
    { width: 1024, height: 440 },
    { width: 430, height: 760 },
    { width: 430, height: 560 },
    { width: 1280, height: 480 },
    { width: 430, height: 600 }
  ]) {
    test(`shows the video, full copy and actions without scrolling at ${viewport.width}×${viewport.height}`, async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const heading = dialog.getByRole('heading', {
        name: enMessages.agent.consent.title
      })
      const accept = dialog.getByRole('button', {
        name: enMessages.agent.consent.accept
      })
      const reject = dialog.getByRole('button', {
        name: enMessages.agent.consent.reject
      })

      await test.step('The entire consent offer is visible together', async () => {
        await page.setViewportSize(viewport)
        await requestConsentFromOpenPanel(page)
        await expect(dialog.getByTestId('agent-consent-video')).toBeInViewport({
          ratio: 1
        })
        await expect(heading).toBeInViewport({ ratio: 1 })
        await expect(
          dialog.getByText(enMessages.agent.consent.body1, { exact: true })
        ).toBeInViewport({ ratio: 1 })
        await expect(
          dialog.getByText(enMessages.agent.consent.body2, { exact: true })
        ).toBeInViewport({ ratio: 1 })
        await expect(
          dialog.getByRole('link', { name: enMessages.agent.consent.readDocs })
        ).toBeInViewport({ ratio: 1 })
        await expect(accept).toBeInViewport({ ratio: 1 })
        await expect(reject).toBeInViewport({ ratio: 1 })
        await expect(accept).toHaveCSS('height', '44px')
        await expect(reject).toHaveCSS('height', '44px')
      })

      await test.step('Skip closes the consent dialog', async () => {
        await reject.click()
        await expect(dialog).toHaveCount(0)
      })
    })
  }

  for (const { from, to, layout, placement } of [
    {
      from: { width: 1024, height: 650 },
      to: { width: 1024, height: 649 },
      layout: 'columns',
      placement: { beside: true, below: false }
    },
    {
      from: { width: 1024, height: 649 },
      to: { width: 1024, height: 650 },
      layout: 'stacked',
      placement: { beside: false, below: true }
    },
    {
      from: { width: 699, height: 560 },
      to: { width: 700, height: 560 },
      layout: 'columns',
      placement: { beside: true, below: false }
    },
    {
      from: { width: 700, height: 560 },
      to: { width: 699, height: 560 },
      layout: 'stacked',
      placement: { beside: false, below: true }
    }
  ]) {
    test(`resizing from ${from.width}×${from.height} to ${to.width}×${to.height} uses ${layout} without losing focus or content`, async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      await page.setViewportSize(from)
      await requestConsentFromOpenPanel(page)
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const video = dialog.getByTestId('agent-consent-video')
      const heading = dialog.getByRole('heading', {
        name: enMessages.agent.consent.title
      })
      const accept = dialog.getByRole('button', {
        name: enMessages.agent.consent.accept
      })
      const reject = dialog.getByRole('button', {
        name: enMessages.agent.consent.reject
      })
      await accept.focus()
      await expect(accept).toBeFocused()

      await page.setViewportSize(to)
      await expect
        .poll(async () => {
          const [mediaBox, headingBox] = await Promise.all([
            video.boundingBox(),
            heading.boundingBox()
          ])
          if (!mediaBox || !headingBox) return undefined
          return {
            beside: headingBox.x >= mediaBox.x + mediaBox.width,
            below: headingBox.y >= mediaBox.y + mediaBox.height
          }
        })
        .toEqual(placement)
      await expect(accept).toBeFocused()
      await expect(video).toBeInViewport({ ratio: 1 })
      await expect(heading).toBeInViewport({ ratio: 1 })
      await expect(
        dialog.getByText(enMessages.agent.consent.body1, { exact: true })
      ).toBeInViewport({ ratio: 1 })
      await expect(
        dialog.getByText(enMessages.agent.consent.body2, { exact: true })
      ).toBeInViewport({ ratio: 1 })
      await expect(
        dialog.getByRole('link', { name: enMessages.agent.consent.readDocs })
      ).toBeInViewport({ ratio: 1 })
      await expect(accept).toBeInViewport({ ratio: 1 })
      await expect(reject).toBeInViewport({ ratio: 1 })
    })
  }

  test('preserves the original silent looping promo design', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await requestConsentFromOpenPanel(page)
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    const video = dialog.locator('video')
    await expect
      .poll(() =>
        video.evaluate((element: HTMLVideoElement) => ({
          playing: !element.paused,
          muted: element.muted,
          loop: element.loop,
          inline: element.playsInline
        }))
      )
      .toEqual({ playing: true, muted: true, loop: true, inline: true })
    await expect(video).not.toHaveAttribute('controls')
    await expect(
      dialog.getByRole('button', { name: enMessages.g.pause, exact: true })
    ).toHaveCount(0)
    await expect(
      dialog.getByRole('button', { name: enMessages.g.play, exact: true })
    ).toHaveCount(0)
  })
})

test.describe('Automatic agent consent', { tag: ['@cloud', '@ui'] }, () => {
  test.use({
    agentConsentAccepted: false,
    agentPanelInitiallyOpen: true
  })

  test('offers once on first load and remains available manually after Skip', async ({
    comfyPage,
    agentPanel,
    agentConsentWrites
  }) => {
    const page = comfyPage.page
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })

    await test.step('First load shows consent without clicking the entry button', async () => {
      await expect(dialog).toBeVisible()
      await expect(agentPanel.root).toBeVisible()
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Skip dismisses the offer without accepting or closing Agent', async () => {
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.reject })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(agentPanel.root).toBeVisible()
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Reload does not repeat the automatic offer', async () => {
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect(agentPanel.openButton).toBeEnabled()
      await expect(dialog).toHaveCount(0)
      await expect(agentPanel.root).toBeVisible()
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('The entry button can still request consent and activate Agent', async () => {
      await requestConsentFromOpenPanel(page)
      await expect(dialog).toBeVisible()
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.accept })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(agentPanel.root).toBeVisible()
      expect(agentConsentWrites).toEqual([true])
    })
  })
})

test.describe(
  'Agent consent on the authenticated web session',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      agentConsentWebSession: true,
      initialLocalStorage: {
        'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal': 'true'
      }
    })

    // Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/19390
    test('persists acceptance without a workspace bearer token', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const panel = page.locator('#agent-panel-root')

      await requestConsentFromOpenPanel(page)
      await expect(dialog).toBeVisible()
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.accept })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(panel).toBeVisible()

      await comfyPage.workflow.reloadAndWaitForApp()
      await expect(dialog).toHaveCount(0)
      await expect(panel).toBeVisible()
    })
  }
)

test.describe(
  'Automatic agent consent in the first session',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentAutoShownReadProbe: true,
      agentConsentAccepted: false,
      initialSettings: { 'Comfy.TutorialCompleted': false },
      initialFeatureFlags: {
        onboarding_tour_enabled: true,
        subscription_required: true
      }
    })
    test.describe.configure({ timeout: 90_000 })

    test('defers the offer until Getting Started releases the screen', async ({
      comfyPage,
      agentPanel,
      agentConsentWrites
    }) => {
      const page = comfyPage.page
      const autoShownKey =
        'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal'
      const gettingStarted = page.getByRole('dialog', {
        name: enMessages.gettingStarted.title
      })
      const consent = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await test.step('Getting Started owns the first screen', async () => {
        await expect(gettingStarted).toBeVisible()
      })

      await test.step('The automatic offer waits without spending its one-time attempt', async () => {
        await expect
          .poll(() => page.evaluate(() => window.__autoShownReads ?? 0), {
            message:
              'the held-offer decision reads the unspent one-shot marker',
            timeout: 15_000
          })
          .toBeGreaterThan(0)
        await expect(consent).toHaveCount(0)
        await expect(agentPanel.root).toBeVisible()
        expect(
          await page.evaluate((key) => localStorage.getItem(key), autoShownKey)
        ).toBeNull()
      })

      await test.step('Taking the blank canvas leaves the activated panel available for a message', async () => {
        await page.getByTestId('getting-started-blank').click()
        await expect(gettingStarted).toHaveCount(0)
        await expect(consent).toHaveCount(0)
        await expect(agentPanel.root).toBeVisible()
        expect(agentConsentWrites).toHaveLength(0)
        expect(
          await page.evaluate((key) => localStorage.getItem(key), autoShownKey)
        ).toBeNull()
      })
    })
  }
)

test.describe(
  'Agent activation behind a desktop sign-in approval',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      initialUrl:
        '/?desktop_login_code=dlc_e2eApprovalCodeFE2808abcdefghijklmnopqrstu'
    })

    test.beforeEach(async ({ page }) => {
      await page.route('**/api/auth/desktop-login-codes/redeem', (route) =>
        route.fulfill({
          status: 200,
          json: {
            status: 'redeemed'
          } satisfies DesktopLoginCodeRedeemResponse
        })
      )
    })

    test('waits for the approval before leaving Agent available', async ({
      comfyPage,
      agentPanel,
      agentConsentReads
    }) => {
      const page = comfyPage.page
      const approval = page.getByRole('dialog', {
        name: enMessages.desktopLogin.confirmSummary
      })
      const consent = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })
      const approve = approval.getByRole('button', {
        name: enMessages.g.confirm
      })

      await test.step('The approval owns the screen and the offer waits behind it', async () => {
        await expect(approval).toBeVisible()
        await expect
          .poll(() => agentConsentReads.length, {
            message: 'the automatic offer runs once the consent read is in',
            timeout: 15_000
          })
          .toBeGreaterThan(0)
        await approve.click({ trial: true })
        await expect(consent).toHaveCount(0)
        await expect(agentPanel.root).toBeVisible()
        expect(
          await page.evaluate(() =>
            localStorage.getItem(
              'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal'
            )
          )
        ).toBeNull()
      })

      await test.step('Approving clears the screen without covering the activated panel', async () => {
        await approve.click()
        await expect(approval).toHaveCount(0)
        await expect(consent).toHaveCount(0)
        await expect(agentPanel.root).toBeVisible()
      })
    })

    test.describe('with first Agent onboarding', () => {
      test.use({
        agentConsentAccepted: true,
        agentOnboardingCompleted: false
      })

      test('shows the coach after the approval closes', async ({
        comfyPage,
        agentPanel,
        agentConsentReads
      }) => {
        const page = comfyPage.page
        const approval = page.getByRole('dialog', {
          name: enMessages.desktopLogin.confirmSummary
        })
        const coach = page.getByRole('dialog', {
          name: enMessages.agent.coachTitle
        })

        await expect(approval).toBeVisible()
        await expect(agentPanel.root).toBeVisible()
        await expect.poll(() => agentConsentReads.length).toBeGreaterThan(0)
        await expect(page.getByRole('dialog')).toHaveCount(1)
        await expect(coach).toHaveCount(0)

        await approval
          .getByRole('button', { name: enMessages.g.confirm })
          .click()

        await expect(approval).toHaveCount(0)
        await expect(coach).toBeVisible()
      })
    })
  }
)
