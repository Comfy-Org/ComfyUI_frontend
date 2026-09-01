import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

test.describe('In-App Agent panel shell', { tag: '@cloud' }, () => {
  test.describe('flag off', () => {
    test.use({ agentFlagEnabled: false })

    test('exposes no agent surface at all', async ({
      page,
      agentFlagEnabled
    }) => {
      await bootAgentApp(page, agentFlagEnabled)

      // Positive anchor: the button's own container rendered, so absence
      // below means gated off, not a missing tab bar.
      await expect(page.getByTestId('integrated-tab-bar-actions')).toBeVisible()
      // The gate settles asynchronously; assert only after it has run, so a
      // late enable cannot slip past auto-retrying negative assertions.
      // Flag-off settles on the flags delivery (posthog fires its callback
      // even when every bootstrap flag is false); the timeout only covers
      // the no-token path.
      await expect(
        page.getByTestId('integrated-tab-bar-actions')
      ).toHaveAttribute('data-agent-gate-settled', 'true', {
        timeout: 8_000
      })

      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL })
      ).toHaveCount(0)
      await expect(page.getByTestId('docked-agent-panel')).toHaveCount(0)
    })
  })

  test('the entry button docks the shell and its close button undocks it', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled)

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()

    const panel = page.getByTestId('docked-agent-panel')
    await expect(panel).toBeVisible()
    // The real shell exposes the stable `#agent-panel-root` id (the stub
    // carried a data-testid instead).
    await expect(page.locator('#agent-panel-root')).toBeVisible()

    await panel.getByRole('button', { name: enMessages.g.close }).click()
    await expect(panel).toHaveCount(0)
  })

  // STYLESHEET LIVENESS ONLY. This appends its own element carrying the class,
  // so it cannot fail if AgentMessage stops emitting that class - the
  // element-to-class half is pinned elsewhere and its replacement gates the
  // deletion of AgentMessage.test.ts's two class assertions.
  test('the shimmer rule resolves to a live animation in a real browser', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled)
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()
    await expect(page.locator('#agent-panel-root')).toBeVisible()

    // happy-dom reports animationName 'none' for this rule even with the
    // stylesheet loaded, so the shimmer's liveness can only be pinned where a
    // real engine resolves the animation shorthand.
    const animationName = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.className = 'agent-shimmer-text'
      document.querySelector('#agent-panel-root')?.appendChild(probe)
      const resolved = getComputedStyle(probe).animationName
      probe.remove()
      return resolved
    })

    expect(animationName).toBe('agent-shimmer')
  })
})
