import { Topbar } from '@e2e/fixtures/components/Topbar'
import {
  expect,
  workflowLinkFixture as test,
  workflowLinkScenario
} from '@e2e/fixtures/workflowLinkFixture'

test.describe('Cloud workflow-id link', { tag: '@cloud' }, () => {
  test.describe('when Cloud finds the sidebar file', () => {
    test.beforeEach(async ({ workflowLink }) => {
      await workflowLink.mockSignedIn()
      await workflowLink.serveLinkedFile()
    })

    test('opens the file, clears the link and saves back to the same file', async ({
      page,
      workflowLink
    }) => {
      const topbar = new Topbar(page)

      await workflowLink.open(workflowLink.linkUrl)

      await expect
        .poll(() => workflowLink.getActiveWorkflowPath())
        .toBe(workflowLinkScenario.path)
      await expect(topbar.getActiveTab()).toContainText(
        workflowLinkScenario.tabName
      )
      await expect.poll(() => workflowLink.hasLinkInUrl()).toBe(false)

      await topbar.triggerTopbarCommand(['File', 'Save'])

      await expect
        .poll(() => workflowLink.getSavedWorkflowPaths())
        .toEqual([workflowLinkScenario.path])
    })
  })

  test.describe('when Cloud refuses the link', () => {
    test.beforeEach(async ({ workflowLink }) => {
      await workflowLink.mockSignedIn()
      await workflowLink.refuseLinkedFile()
    })

    test('shows the error and leaves the restored tabs as they were', async ({
      page,
      toast,
      workflowLink
    }) => {
      const topbar = new Topbar(page)
      await workflowLink.openWithRestoredTabs()
      await expect(topbar.tabs.first()).toBeVisible()
      const restoredTabs = await topbar.getTabNames()
      const restoredActiveTab = await topbar.getActiveTabName()

      await workflowLink.open(workflowLink.linkUrl)

      await expect(
        toast.withText(workflowLinkScenario.notOpenedToast)
      ).toBeVisible()
      await expect.poll(() => topbar.getTabNames()).toEqual(restoredTabs)
      expect(await topbar.getActiveTabName()).toBe(restoredActiveTab)
      await expect.poll(() => workflowLink.hasLinkInUrl()).toBe(false)
    })
  })

  test.describe('when the visitor is signed out', () => {
    test.beforeEach(async ({ workflowLink }) => {
      await workflowLink.mockSignedOut()
      await workflowLink.serveLinkedFile()
    })

    test('keeps the link through sign-in and opens the file after it', async ({
      page,
      workflowLink
    }) => {
      await page.goto(workflowLink.linkUrl)

      await workflowLink.signInWithEmail()

      await expect
        .poll(() => workflowLink.getActiveWorkflowPath())
        .toBe(workflowLinkScenario.path)
      await expect.poll(() => workflowLink.hasLinkInUrl()).toBe(false)
    })
  })
})
