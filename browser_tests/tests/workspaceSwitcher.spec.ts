import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import {
  LONG_WORKSPACE_NAME,
  OFF_SCREEN_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME,
  createManyWorkspacesResponse
} from '@e2e/fixtures/data/workspaceSwitcher'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'
import { workspaceSwitcherTest as test } from '@e2e/fixtures/workspaceSwitcherFixture'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

// text-sm rows render a single 20px line; a wrapped name is 40px+.
const SINGLE_LINE_MAX_HEIGHT_PX = 28
const FLYOUT_GAP_PX = 8
const FLYOUT_WIDTH_PX = 256
const FLYOUT_ROW_HEIGHT_PX = 40
const FLYOUT_ROW_LABEL_INSET_PX = 32

function profileMenuOf(page: Page) {
  return page.locator('[data-slot="popover-content"]', {
    has: page.getByTestId('current-user-popover')
  })
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected a laid-out element')
  return box
}

async function creditsFlyoutLayout(page: Page) {
  const flyout = page
    .locator('[data-side]')
    .filter({ has: page.getByTestId('credits-flyout') })
  const [menu, row, flyoutBox, rowLabel, firstLine] = await Promise.all([
    boxOf(profileMenuOf(page)),
    boxOf(page.getByTestId('credits-menu-item')),
    boxOf(flyout),
    boxOf(
      page
        .getByTestId('credits-menu-item')
        .getByText('Credits', { exact: true })
    ),
    boxOf(page.getByTestId('credits-breakdown').locator('span').first())
  ])
  return {
    width: Math.round(flyoutBox.width),
    gap: Math.round(flyoutBox.x - (menu.x + menu.width)),
    firstLineBelowCreditsLabel: Math.round(firstLine.y - rowLabel.y),
    runsPastMenuBottom:
      flyoutBox.y + flyoutBox.height > menu.y + menu.height + 0.5,
    startsAboveMenuTop: flyoutBox.y < menu.y - 0.5,
    opensBesideCreditsRow: flyoutBox.y < row.y + row.height
  }
}

test.describe('Workspace switcher', { tag: '@cloud' }, () => {
  test('renders a long team workspace name on a single line', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByText(PERSONAL_WORKSPACE_NAME).click()

    const longName = page.getByText(LONG_WORKSPACE_NAME)
    await expect(longName).toBeVisible()

    const box = await longName.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeLessThan(SINGLE_LINE_MAX_HEIGHT_PX)
  })

  test('opens the switcher toward the canvas, 8px right of the sidebar profile menu, level with its top and 256px wide', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    const button = page.getByRole('button', { name: 'Current user' })
    await expect(page.getByTestId('side-toolbar').locator(button)).toBeVisible()
    await button.click()
    await page.getByTestId('workspace-switcher-trigger').click()

    const panel = page.getByTestId('workspace-switcher-panel')
    await expect(panel).toBeVisible()
    await expect(
      panel.getByText('Workspaces only affect which credits you use.')
    ).toHaveCount(0)

    const profileMenu = profileMenuOf(page)
    await expect
      .poll(async () => {
        const [panelBox, profileBox] = await Promise.all([
          panel.boundingBox(),
          profileMenu.boundingBox()
        ])
        if (!panelBox || !profileBox) return null
        return {
          gap: Math.round(panelBox.x - (profileBox.x + profileBox.width)),
          topBelowMenuTop: Math.round(panelBox.y - profileBox.y),
          width: Math.round(panelBox.width)
        }
      })
      .toEqual({
        gap: FLYOUT_GAP_PX,
        topBelowMenuTop: 0,
        width: FLYOUT_WIDTH_PX
      })
    await expect(panel).toBeInViewport({ ratio: 1 })
  })

  test.describe('credits flyout', () => {
    test('opens 8px right of the menu, 256px wide, its first line level with the Credits row', async ({
      comfyPage
    }) => {
      const page = comfyPage.page

      await comfyPage.toast.closeToasts()
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByTestId('credits-menu-item').hover()
      await expect(page.getByTestId('credits-flyout')).toBeVisible()

      await expect
        .poll(() => creditsFlyoutLayout(page))
        .toEqual({
          width: FLYOUT_WIDTH_PX,
          gap: FLYOUT_GAP_PX,
          firstLineBelowCreditsLabel: 0,
          runsPastMenuBottom: false,
          startsAboveMenuTop: false,
          opensBesideCreditsRow: true
        })
      const menuFill = await profileMenuOf(page).evaluate(
        (menu) => getComputedStyle(menu).backgroundColor
      )
      await expect(
        page.locator('[data-side]').filter({
          has: page.getByTestId('credits-flyout')
        })
      ).toHaveCSS('background-color', menuFill)
    })

    test('lays out Add credits and Billing settings as 40px menu rows led by an icon', async ({
      comfyPage
    }) => {
      const page = comfyPage.page

      await comfyPage.toast.closeToasts()
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByTestId('credits-menu-item').hover()
      const flyout = page.getByTestId('credits-flyout')
      await expect(flyout).toBeVisible()

      for (const name of ['Add credits', 'Billing settings']) {
        const row = flyout.getByRole('button', { name })
        const label = row.getByText(name, { exact: true })
        await expect
          .poll(
            async () => {
              const [rowBox, labelBox] = await Promise.all([
                boxOf(row),
                boxOf(label)
              ])
              return {
                height: Math.round(rowBox.height),
                labelInset: Math.round(labelBox.x - rowBox.x)
              }
            },
            { message: `${name} row height and label inset` }
          )
          .toEqual({
            height: FLYOUT_ROW_HEIGHT_PX,
            labelInset: FLYOUT_ROW_LABEL_INSET_PX
          })
      }
    })

    test('keeps a flyout taller than the space below the Credits row inside the menu', async ({
      comfyPage
    }) => {
      const page = comfyPage.page

      await comfyPage.toast.closeToasts()
      await page.addStyleTag({
        content: '[data-testid="credits-flyout"] { min-height: 240px; }'
      })
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByTestId('credits-menu-item').hover()
      await expect(page.getByTestId('credits-flyout')).toBeVisible()

      await expect
        .poll(async () => {
          const layout = await creditsFlyoutLayout(page)
          return {
            runsPastMenuBottom: layout.runsPastMenuBottom,
            startsAboveMenuTop: layout.startsAboveMenuTop
          }
        })
        .toEqual({ runsPastMenuBottom: false, startsAboveMenuTop: false })
    })
  })

  test.describe('with billing_new_ux_enabled off', () => {
    test.use({ billingNewUx: false })

    test('opens the switcher to the left of the profile menu without overlap', async ({
      comfyPage
    }) => {
      const page = comfyPage.page

      await comfyPage.toast.closeToasts()
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByTestId('workspace-switcher-trigger').click()

      const panel = page.getByTestId('workspace-switcher-panel')
      await expect(panel).toBeVisible()

      const profileMenu = page.locator('.current-user-popover')
      await expect
        .poll(async () => {
          const [panelBox, profileBox] = await Promise.all([
            panel.boundingBox(),
            profileMenu.boundingBox()
          ])
          if (!panelBox || !profileBox) return Number.POSITIVE_INFINITY
          return panelBox.x + panelBox.width - profileBox.x
        })
        .toBeLessThanOrEqual(0)
    })
  })

  for (const { name, viewport, reducedMotion } of [
    {
      name: 'desktop',
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'no-preference'
    },
    {
      name: 'short viewport',
      viewport: { width: 1024, height: 600 },
      reducedMotion: 'no-preference'
    },
    {
      name: 'reduced motion',
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce'
    }
  ] as const) {
    test.describe(name, () => {
      test.use({ viewport, reducedMotion })

      test('keeps the switcher clear throughout its entrance', async ({
        comfyPage
      }) => {
        const page = comfyPage.page
        await comfyPage.toast.closeToasts()
        const button = page.getByRole('button', { name: 'Current user' })
        await button.scrollIntoViewIfNeeded()
        await button.click()
        await expect(page.getByTestId('current-user-popover')).toBeVisible()
        await page.addStyleTag({
          content:
            '[data-testid="workspace-switcher-panel"] { animation-play-state: paused; }'
        })
        await page.getByTestId('workspace-switcher-trigger').click()

        const panel = page.getByTestId('workspace-switcher-panel')
        await expect(panel).toBeVisible()
        const profileBox = await page
          .getByTestId('current-user-popover')
          .boundingBox()
        expect(profileBox).not.toBeNull()
        const leftEdges = await panel.evaluate((element) => {
          const animations = element.getAnimations()
          return [0, 0.25, 0.5, 0.75, 1].map((progress) => {
            animations.forEach((animation) => {
              animation.currentTime =
                Number(animation.effect?.getComputedTiming().endTime) * progress
            })
            return element.getBoundingClientRect().left
          })
        })
        expect(Math.min(...leftEdges)).toBeGreaterThanOrEqual(
          profileBox!.x + profileBox!.width
        )
      })
    })
  }

  test.describe('on a phone-width viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('keeps the switcher on screen and switches workspaces', async ({
      comfyPage
    }) => {
      const page = comfyPage.page

      await comfyPage.toast.closeToasts()
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByTestId('workspace-switcher-trigger').click()

      const panel = page.getByTestId('workspace-switcher-panel')
      const teamRow = panel.getByText(TEAM_WORKSPACE_NAME, { exact: true })
      await expect(panel).toBeInViewport({ ratio: 1 })

      await teamRow.click()
      await comfyPage.waitForAppReady()

      await page.getByRole('button', { name: 'Current user' }).click()
      await expect(
        page.getByTestId('workspace-switcher-trigger')
      ).toContainText(TEAM_WORKSPACE_NAME)
    })
  })

  test(
    'scrolls the list to reveal workspaces past the visible area',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const page = comfyPage.page

      await mockWorkspaceList(page, createManyWorkspacesResponse())

      // Workspace list is fetched once on boot; reload to pick up the override.
      await comfyPage.workflow.reloadAndWaitForApp()

      await comfyPage.toast.closeToasts()
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByTestId('workspace-switcher-trigger').click()

      const list = page.getByTestId('workspace-switcher-list')
      await expect(list).toBeVisible()
      const offScreenRow = list.getByText(OFF_SCREEN_WORKSPACE_NAME)

      // toBeInViewport() passes via window scroll too, so drive a real wheel
      // scroll to assert the list itself scrolls.
      await expect(offScreenRow).not.toBeInViewport()

      await list.hover()
      await page.mouse.wheel(0, 2000)

      await expect
        .poll(() => list.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0)
      await expect
        .poll(() => page.evaluate(() => document.scrollingElement?.scrollTop))
        .toBe(0)
      await expect(offScreenRow).toBeInViewport()

      await expectElementScreenshot(list, 'workspace-switcher-scrolled.png')
    }
  )

  test('opens the create-workspace dialog with DES-246 copy', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()

    await page.getByText('Create workspace').click()

    await expect(
      page.getByText(
        'Workspaces keep your projects and files organized. Subscribe to a Team plan to invite members.'
      )
    ).toBeVisible()
    await expect(page.getByPlaceholder('Ex: Comfy Org')).toBeVisible()
  })

  test('refreshes billing capabilities after switching workspaces', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('credits-menu-item').hover()
    await expect(page.getByTestId('add-credits-button')).toBeEnabled()
    const longWorkspaceCapabilities = page.waitForResponse(
      (response) =>
        response.url().includes('/api/billing/capabilities') &&
        response.request().headers()['authorization'] ===
          'Bearer mock-workspace-token-ws-team-long'
    )
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(LONG_WORKSPACE_NAME, { exact: true })
      .click()
    await longWorkspaceCapabilities
    await comfyPage.waitForAppReady()

    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('credits-menu-item').hover()
    await expect(page.getByTestId('add-credits-button')).toBeDisabled()
  })

  test('isolates all open workflow tabs between workspaces', async ({
    comfyPage
  }) => {
    test.slow()
    const page = comfyPage.page
    const suffix = Date.now().toString(36)
    const personalWorkflows = [`personal-a-${suffix}`, `personal-b-${suffix}`]
    const teamWorkflows = [`team-a-${suffix}`, `team-b-${suffix}`]

    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.menu.topbar.saveWorkflow(personalWorkflows[0])
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(personalWorkflows[1])

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(TEAM_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .not.toEqual(expect.arrayContaining(personalWorkflows))
    await comfyPage.menu.topbar.saveWorkflow(teamWorkflows[0])
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(teamWorkflows[1])

    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(PERSONAL_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(personalWorkflows)
    await expect(comfyPage.menu.topbar.getActiveTab()).toContainText(
      personalWorkflows[1]
    )

    await comfyPage.workflow.reloadAndWaitForApp()
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(personalWorkflows)

    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(TEAM_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(teamWorkflows)
    await expect(comfyPage.menu.topbar.getActiveTab()).toContainText(
      teamWorkflows[1]
    )

    await comfyPage.workflow.reloadAndWaitForApp()
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(teamWorkflows)
  })
})
