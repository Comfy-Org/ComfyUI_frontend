import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

test.describe(
  'In-App Agent panel lifecycle and accessibility',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    test('preserves the stored preference while the flag is off', async ({
      page
    }) => {
      await page.addInitScript((key) => {
        localStorage.setItem(key, 'true')
      }, OPEN_STORAGE_KEY)
      await bootAgentApp(page, false)

      const actions = page.getByTestId('integrated-tab-bar-actions')
      await expect(actions).toHaveAttribute('data-agent-gate-settled', 'true', {
        timeout: 8_000
      })
      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
      ).toHaveCount(0)
      await expect(page.getByTestId('docked-agent-panel')).toHaveCount(0)
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('true')
    })

    test('persists open and closed state and keeps the entry button pressed while open', async ({
      page
    }) => {
      await bootAgentApp(page, true)

      const openButton = page.getByRole('button', {
        name: OPEN_AGENT_LABEL,
        exact: true
      })
      const panel = page.getByTestId('docked-agent-panel')

      await expect(openButton).toBeVisible()
      await openButton.click()
      await expect(panel).toBeVisible()
      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
      ).toHaveAttribute('aria-pressed', 'true')
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('true')

      await panel.getByRole('button', { name: enMessages.g.close }).click()
      await expect(panel).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
      ).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('false')
    })

    test('supports keyboard activation and returns one complementary landmark', async ({
      page
    }) => {
      await bootAgentApp(page, true)

      const openButton = page.getByRole('button', {
        name: OPEN_AGENT_LABEL,
        exact: true
      })
      await openButton.focus()
      await openButton.press('Enter')

      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()
      await expect(panel).toHaveAttribute('role', 'complementary')
      await expect(panel).toHaveAttribute(
        'aria-labelledby',
        'agent-panel-title'
      )
      await expect(page.locator('#agent-panel-title')).toHaveCount(1)
      await expect(page.getByRole('complementary')).toHaveCount(1)

      await panel
        .getByRole('button', { name: enMessages.g.close })
        .press('Enter')
      await expect(panel).toHaveCount(0)
      await expect(openButton).toBeVisible()
    })

    test('keeps the dock within the viewport and its documented width cap', async ({
      page
    }) => {
      await bootAgentApp(page, true)

      await page
        .getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
        .click()
      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()

      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(0)

      const box = await panel.boundingBox()
      const viewport = page.viewportSize()
      expect(box).not.toBeNull()
      expect(viewport).not.toBeNull()
      expect(box!.width).toBeGreaterThan(0)
      expect(box!.width).toBeLessThanOrEqual(420)
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
      await expect(page.getByTestId('integrated-tab-bar-actions')).toBeVisible()
    })

    test('shrinks a maximized panel to stay inside a narrowed window', async ({
      page
    }) => {
      await page.setViewportSize({ width: 1600, height: 900 })
      await bootAgentApp(page, true)

      await page
        .getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
        .click()
      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()

      await panel
        .getByRole('button', { name: enMessages.agent.maximize })
        .click()
      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBe(960)

      await page.setViewportSize({ width: 900, height: 900 })

      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeLessThan(960)
      const box = await panel.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(901)

      // "Inside the window" is not enough on its own: a panel that ignored the
      // sidebar and took all 900px would satisfy every bound above. Pin it
      // against the workspace it is supposed to be reserving room for.
      const sideToolbar = page.getByTestId('side-toolbar')
      const railBox = await sideToolbar.boundingBox()
      expect(railBox).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(railBox!.x + railBox!.width - 1)

      // Still maximized, so the header offers to minimize rather than maximize.
      await expect(
        panel.getByRole('button', { name: enMessages.agent.minimize })
      ).toBeVisible()
    })

    test('keeps the canvas toolbar clear of the sidebar as the panel squeezes it', async ({
      page
    }) => {
      await page.setViewportSize({ width: 900, height: 900 })
      await bootAgentApp(page, true)

      await page
        .getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
        .click()
      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()
      await panel
        .getByRole('button', { name: enMessages.agent.maximize })
        .click()

      const toolbar = page.getByRole('toolbar', {
        name: enMessages.graphCanvasMenu.canvasToolbar
      })
      const sideToolbar = page.getByTestId('side-toolbar')
      await expect(toolbar).toBeVisible()

      const toolbarBox = await toolbar.boundingBox()
      const sideToolbarBox = await sideToolbar.boundingBox()
      expect(toolbarBox).not.toBeNull()
      expect(sideToolbarBox).not.toBeNull()

      // Both edges matter. Checking only the left edge passes a toolbar that
      // overhangs the other way, out from under the canvas and beneath the
      // expanded panel, which is the case this fix is actually about.
      expect(toolbarBox!.x).toBeGreaterThanOrEqual(
        sideToolbarBox!.x + sideToolbarBox!.width - 1
      )
      // Deliberately not asserting that the toolbar ends left of the panel.
      // That needs the canvas to have room, and reserving canvas width is not
      // what this change does: `maxWidth` reserves the rail and the sidebar
      // minimum only, so at this viewport a maximized panel still leaves the
      // canvas near zero. `agentPanelViewportDrag.spec.ts` owns that gap, and
      // its canvas-toolbar and Run-control cases are still `test.fail` for
      // exactly this reason. Asserting it here would fail the PR for a defect
      // it never claimed to fix.

      // Position alone is satisfied by a toolbar squeezed to nothing, so prove
      // the controls at both ends survived and are still operable.
      expect(toolbarBox!.width).toBeGreaterThan(64)
      await expect(
        toolbar.getByRole('button', { name: enMessages.zoomControls.label })
      ).toBeVisible()
      await toolbar
        .getByRole('button', { name: enMessages.graphCanvasMenu.fitView })
        .click()
    })

    test('restores an open panel after a browser reload', async ({ page }) => {
      await bootAgentApp(page, true)

      await page
        .getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
        .click()
      await expect(page.getByTestId('docked-agent-panel')).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
        )
        .toBe('true')

      await page.reload()
      await expect(
        page.getByTestId('integrated-tab-bar-actions')
      ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 8_000 })
      await expect(page.getByTestId('docked-agent-panel')).toBeVisible()
      await expect(
        page.getByRole('button', { name: OPEN_AGENT_LABEL, exact: true })
      ).toHaveAttribute('aria-pressed', 'true')
    })

    test('keeps one Agent panel mounted while switching workflow tabs', async ({
      page,
      agentFlagEnabled
    }) => {
      await bootAgentApp(page, agentFlagEnabled)

      const openButton = page.getByRole('button', {
        name: OPEN_AGENT_LABEL,
        exact: true
      })
      await openButton.click()

      const panel = page.getByTestId('docked-agent-panel')
      const tabs = new Topbar(page).tabs
      await expect(panel).toBeVisible()
      await expect(tabs).toHaveCount(1)

      await page.locator('.new-blank-workflow-button').click()
      await expect(tabs).toHaveCount(2)
      await tabs.first().click()

      await expect(panel).toHaveCount(1)
      await expect(panel).toBeVisible()
    })
  }
)
