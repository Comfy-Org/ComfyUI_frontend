import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import frMessages from '@/locales/fr/main.json' with { type: 'json' }

import { agentConsentTest as test } from '@e2e/fixtures/agentConsentFixture'

test.describe('Manual agent consent gate', { tag: ['@cloud', '@ui'] }, () => {
  test.use({
    agentConsentAccepted: false,
    initialLocalStorage: {
      'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal': 'true'
    }
  })

  test('dismisses without activation and persists acceptance before opening', async ({
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

    await test.step('Skip leaves Agent closed without saving consent', async () => {
      await openButton.click()
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

    test('keeps the panel hidden until the user accepts', async ({
      comfyPage,
      agentPanelFlash
    }) => {
      const page = comfyPage.page
      const panel = page.locator('#agent-panel-root')
      const dialog = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await test.step('Restoring open intent never renders the unaccepted panel during boot', async () => {
        expect(await agentPanelFlash.hasFlashed()).toBe(false)
        await expect(panel).toHaveCount(0)
      })

      await test.step('Explicit acceptance makes the panel visible', async () => {
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()
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
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()
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
      await expect(page.locator('html')).not.toHaveClass(/dark-theme/)
    })

    await test.step('Consent keeps its dark surface and readable heading', async () => {
      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
        .click()
      await expect(page.getByTestId('agent-consent-card')).toHaveCSS(
        'background-color',
        'rgb(23, 23, 24)'
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
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()
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
            return acceptBox && rejectBox ? acceptBox.y < rejectBox.y : false
          })
          .toBe(true)
      })

      await test.step('Keyboard order follows docs, Start, then Skip', async () => {
        await docs.focus()
        await expect(docs).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(accept).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(reject).toBeFocused()
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
      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
        .click()

      const video = page.getByTestId('agent-consent-video')
      await expect(video).toHaveJSProperty(
        'currentSrc',
        'https://media.comfy.org/website/comfy-agent/agent-consent-1280.mp4'
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
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()

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
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()

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

  test('keeps actions reachable in a short wide window', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    const accept = dialog.getByRole('button', {
      name: enMessages.agent.consent.accept
    })
    const reject = dialog.getByRole('button', {
      name: enMessages.agent.consent.reject
    })

    await test.step('Short wide layout keeps both actions reachable', async () => {
      await page.setViewportSize({ width: 1280, height: 480 })
      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
        .click()
      await accept.scrollIntoViewIfNeeded()
      await expect(accept).toBeInViewport({ ratio: 1 })
      await expect(reject).toBeInViewport({ ratio: 1 })
    })

    await test.step('Skip closes the consent dialog', async () => {
      await reject.click()
      await expect(dialog).toHaveCount(0)
    })
  })

  test('lets a narrow short window scroll from the heading to the actions', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const dialog = page.getByRole('dialog', {
      name: enMessages.agent.consent.title
    })
    const heading = dialog.getByRole('heading', {
      name: enMessages.agent.consent.title
    })
    const reject = dialog.getByRole('button', {
      name: enMessages.agent.consent.reject
    })

    await test.step('Short narrow layout lets the user reach the heading', async () => {
      await page.setViewportSize({ width: 430, height: 600 })
      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
        .click()
      await heading.scrollIntoViewIfNeeded()
      await expect(heading).toBeInViewport({ ratio: 1 })
    })

    await test.step('User can scroll from the heading to Skip', async () => {
      await reject.scrollIntoViewIfNeeded()
      await expect(reject).toBeInViewport({ ratio: 1 })
      await reject.click()
      await expect(dialog).toHaveCount(0)
    })
  })

  test('preserves the original silent looping promo design', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    await page
      .getByRole('button', { name: enMessages.agent.entryButton, exact: true })
      .click()
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
  test.use({ agentConsentAccepted: false })

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
      await expect(agentPanel.root).toHaveCount(0)
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Skip dismisses the offer without accepting or opening Agent', async () => {
      await dialog
        .getByRole('button', { name: enMessages.agent.consent.reject })
        .click()
      await expect(dialog).toHaveCount(0)
      await expect(agentPanel.root).toHaveCount(0)
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('Reload does not repeat the automatic offer', async () => {
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect(agentPanel.openButton).toBeEnabled()
      await expect(dialog).toHaveCount(0)
      await expect(agentPanel.root).toHaveCount(0)
      expect(agentConsentWrites).toHaveLength(0)
    })

    await test.step('The entry button can still request consent and activate Agent', async () => {
      await agentPanel.openButton.click()
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
  'Automatic agent consent in the first session',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      initialSettings: { 'Comfy.TutorialCompleted': false },
      initialFeatureFlags: {
        onboarding_tour_enabled: true,
        subscription_required: true
      }
    })

    test('stays silent for the session once Getting Started took the screen', async ({
      comfyPage,
      agentPanel,
      agentConsentReads
    }) => {
      const page = comfyPage.page
      const gettingStarted = page.getByRole('dialog', {
        name: enMessages.gettingStarted.title
      })
      const consent = page.getByRole('dialog', {
        name: enMessages.agent.consent.title
      })

      await test.step('Getting Started owns the first screen', async () => {
        await expect(gettingStarted).toBeVisible()
      })

      await test.step('The automatic offer runs and stays silent', async () => {
        await expect
          .poll(() => agentConsentReads.length, {
            message:
              'the automatic offer runs once the consent read and the boot decision are both in; the fixture already waited past the decision (the loading overlay clears after it), so the read is the last input and the silence below is a decision, not a race',
            timeout: 15_000
          })
          .toBeGreaterThan(0)
        await expect(consent).toHaveCount(0)
        await expect(agentPanel.root).toHaveCount(0)
        expect(
          await page.evaluate(() =>
            localStorage.getItem(
              'Comfy.AgentConsent.AutoShown.test-user-e2e.ws-personal'
            )
          )
        ).toBeNull()
      })
    })
  }
)

test.describe(
  'Automatic agent consent behind a desktop sign-in approval',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      agentConsentAccepted: false,
      initialUrl:
        '/?desktop_login_code=dlc_e2eApprovalCodeFE2808abcdefghijklmnopqrstu'
    })

    test('waits for the approval before offering Agent', async ({
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
      await page.route('**/api/auth/desktop-login-codes/redeem', (route) =>
        route.fulfill({ status: 200, json: {} })
      )

      await test.step('The approval owns the screen and the offer waits behind it', async () => {
        await expect(approval).toBeVisible()
        await expect
          .poll(() => agentConsentReads.length, {
            message:
              'the automatic offer runs once the consent read is in; the fixture already waited past the boot decision, so the absence below is the offer waiting, not a race',
            timeout: 15_000
          })
          .toBeGreaterThan(0)
        await expect(consent).toHaveCount(0)
        await expect(agentPanel.root).toHaveCount(0)
      })

      await test.step('Approving clears the screen and the offer follows', async () => {
        await approval
          .getByRole('button', { name: enMessages.g.confirm })
          .click()
        await expect(approval).toHaveCount(0)
        await expect(consent).toBeVisible()
      })
    })
  }
)
