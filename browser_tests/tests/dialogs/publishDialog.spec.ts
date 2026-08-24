import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { PublishDialog } from '@e2e/fixtures/components/PublishDialog'

import { publishFixture as test } from '@e2e/fixtures/helpers/PublishApiHelper'

const PUBLISH_FEATURE_FLAGS = {
  comfyhub_upload_enabled: true,
  comfyhub_profile_gate_enabled: true
} as const

async function saveAndOpenPublishDialog(
  comfyPage: ComfyPage,
  dialog: PublishDialog,
  workflowName: string
): Promise<void> {
  await comfyPage.menu.topbar.saveWorkflow(workflowName)
  const overwriteDialog = comfyPage.page
    .getByRole('dialog')
    .filter({ hasText: 'Overwrite' })
  // Bounded wait: point-in-time isVisible() can miss dialogs that open
  // slightly after saveWorkflow() resolves.
  try {
    await overwriteDialog.waitFor({ state: 'visible', timeout: 500 })
    await comfyPage.confirmDialog.click('overwrite')
  } catch {
    // No overwrite dialog — workflow name was unique.
  }

  await dialog.open()
}

test.describe('Publish dialog - wizard navigation', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks()
    await saveAndOpenPublishDialog(comfyPage, publishDialog, 'test-publish-wf')
  })

  test('opens on the Describe step by default', async ({ publishDialog }) => {
    await expect(publishDialog.describeStep).toBeVisible()
    await expect(publishDialog.nameInput).toBeVisible()
    await expect(publishDialog.descriptionTextarea).toBeVisible()
  })

  test('pre-fills workflow name from active workflow', async ({
    publishDialog
  }) => {
    await expect(publishDialog.nameInput).toHaveValue(/test-publish-wf/)
  })

  test('Next button navigates to Examples step', async ({ publishDialog }) => {
    await publishDialog.goNext()
    await expect(publishDialog.describeStep).toBeHidden()
    // Examples step should show thumbnail toggle and upload area
    await expect(
      publishDialog.root.getByText('Select a thumbnail')
    ).toBeVisible()
  })

  test('Back button returns to Describe step from Examples', async ({
    publishDialog
  }) => {
    await publishDialog.goNext()
    await expect(publishDialog.describeStep).toBeHidden()

    await publishDialog.goBack()
    await expect(publishDialog.describeStep).toBeVisible()
  })

  test('navigates through all steps to Finish', async ({ publishDialog }) => {
    await publishDialog.goNext() // → Examples
    await publishDialog.goNext() // → Finish
    await expect(publishDialog.finishStep).toBeVisible()
    await expect(publishDialog.publishButton).toBeVisible()
  })

  test('clicking nav step navigates directly', async ({ publishDialog }) => {
    await publishDialog.goToStep('Finish publishing')
    await expect(publishDialog.finishStep).toBeVisible()

    await publishDialog.goToStep('Describe your workflow')
    await expect(publishDialog.describeStep).toBeVisible()
  })

  test('closes dialog via Escape key', async ({ comfyPage, publishDialog }) => {
    await comfyPage.page.keyboard.press('Escape')
    await expect(publishDialog.root).toBeHidden()
  })
})

test.describe('Publish dialog - Describe step', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks()
    await saveAndOpenPublishDialog(comfyPage, publishDialog, 'test-describe-wf')
  })

  test('allows editing the Hub title', async ({ publishDialog }) => {
    await publishDialog.nameInput.clear()
    await publishDialog.nameInput.fill('My Custom Workflow')
    await expect(publishDialog.nameInput).toHaveValue('My Custom Workflow')
  })

  test('allows editing the description', async ({ publishDialog }) => {
    await publishDialog.descriptionTextarea.fill(
      'A great workflow for anime art'
    )
    await expect(publishDialog.descriptionTextarea).toHaveValue(
      'A great workflow for anime art'
    )
  })

  test('displays tag suggestions from mocked API', async ({
    publishDialog
  }) => {
    await expect(publishDialog.root.getByText('anime')).toBeVisible()
    await expect(publishDialog.root.getByText('upscale')).toBeVisible()
  })

  // TODO(#11548): Tag click emits update:tags but the tag does not appear in
  // the active list during E2E. Needs investigation of the parent state
  // binding.
  test.fixme('clicking a tag suggestion adds it', async ({ publishDialog }) => {
    await publishDialog.root.getByText('anime').click()

    await expect(publishDialog.tagsInput.getByText('anime')).toBeVisible()
  })
})

test.describe('Publish dialog - Examples step', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks()
    await saveAndOpenPublishDialog(comfyPage, publishDialog, 'test-examples-wf')
    await publishDialog.goNext() // Navigate to Examples step
  })

  test('shows thumbnail type toggle options', async ({ publishDialog }) => {
    await expect(
      publishDialog.root.getByText('Image', { exact: true })
    ).toBeVisible()
    await expect(
      publishDialog.root.getByText('Video', { exact: true })
    ).toBeVisible()
    await expect(
      publishDialog.root.getByText('Image comparison', { exact: true })
    ).toBeVisible()
  })

  test('shows example image upload tile', async ({ publishDialog }) => {
    await expect(
      publishDialog.root.getByRole('button', { name: 'Upload example image' })
    ).toBeVisible()
  })
})

test.describe('Publish dialog - Finish step with profile', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks({ hasProfile: true })
    await saveAndOpenPublishDialog(comfyPage, publishDialog, 'test-finish-wf')
    await publishDialog.goToStep('Finish publishing')
  })

  test('shows profile card with username', async ({ publishDialog }) => {
    await expect(publishDialog.finishStep).toBeVisible()
    await expect(publishDialog.root.getByText('@testuser')).toBeVisible()
    await expect(publishDialog.root.getByText('Test User')).toBeVisible()
  })

  test('publish button is enabled when no private assets', async ({
    publishDialog
  }) => {
    await expect(publishDialog.publishButton).toBeEnabled()
  })
})

test.describe('Publish dialog - Finish step with private assets', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks({
      hasProfile: true,
      hasPrivateAssets: true
    })
    await saveAndOpenPublishDialog(comfyPage, publishDialog, 'test-assets-wf')
    await publishDialog.goToStep('Finish publishing')
  })

  test('publish button is disabled until assets acknowledged', async ({
    publishDialog
  }) => {
    await expect(publishDialog.finishStep).toBeVisible()
    await expect(publishDialog.publishButton).toBeDisabled()

    const checkbox = publishDialog.finishStep.getByRole('checkbox')
    await checkbox.check()

    await expect(publishDialog.publishButton).toBeEnabled()
  })
})

test.describe('Publish dialog - no profile', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks({ hasProfile: false })
    await saveAndOpenPublishDialog(
      comfyPage,
      publishDialog,
      'test-noprofile-wf'
    )
    await publishDialog.goToStep('Finish publishing')
  })

  test('shows profile creation prompt when user has no profile', async ({
    publishDialog
  }) => {
    await expect(publishDialog.profilePrompt).toBeVisible()
    await expect(
      publishDialog.root.getByText(
        'Create a profile to publish to Comfy Workflows'
      )
    ).toBeVisible()
  })

  test('clicking create profile CTA shows profile creation form', async ({
    publishDialog
  }) => {
    await publishDialog.root
      .getByRole('button', { name: 'Create a profile' })
      .click()
    await expect(publishDialog.gateFlow).toBeVisible()
  })
})

test.describe('Publish dialog - unsaved workflow', () => {
  test.beforeEach(async ({ comfyPage, publishApi }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks()
    // Don't save workflow — open dialog on the default temporary workflow
  })

  test('shows save prompt for temporary workflow', async ({
    comfyPage,
    publishDialog
  }) => {
    // Create a new workflow to ensure it's temporary
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await publishDialog.open()

    await expect(publishDialog.savePrompt).toBeVisible()
    await expect(
      publishDialog.root.getByText(
        'You must save your workflow before publishing'
      )
    ).toBeVisible()
    // Nav should be hidden when save is required
    await expect(publishDialog.nav).toBeHidden()
  })
})

test.describe('Publish dialog - workflow identity', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks({ hasProfile: true })
    await saveAndOpenPublishDialog(
      comfyPage,
      publishDialog,
      'test-independent-title-wf'
    )
  })

  test('keeps the saved workflow path when the Hub title differs', async ({
    comfyPage,
    publishDialog
  }) => {
    await publishDialog.nameInput.clear()
    await publishDialog.nameInput.fill('Different Hub title')
    await publishDialog.goToStep('Finish publishing')
    await expect(publishDialog.finishStep).toBeVisible()

    await publishDialog.publishButton.click()
    await expect(publishDialog.root).toBeHidden({ timeout: 10_000 })
    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .toBe('workflows/test-independent-title-wf.json')
  })
})

test.describe('Publish dialog - submission', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
  })

  test('successful publish closes dialog', async ({
    comfyPage,
    publishApi,
    publishDialog
  }) => {
    await publishApi.setupDefaultMocks({ hasProfile: true })
    await saveAndOpenPublishDialog(comfyPage, publishDialog, 'test-submit-wf')
    await publishDialog.goToStep('Finish publishing')
    await expect(publishDialog.finishStep).toBeVisible()

    await publishDialog.publishButton.click()
    await expect(publishDialog.root).toBeHidden({ timeout: 10_000 })
  })

  test('failed publish shows error toast', async ({
    comfyPage,
    publishApi,
    publishDialog
  }) => {
    await publishApi.setupDefaultMocks({ hasProfile: true })
    // Override publish mock with error response
    await publishApi.mockPublishWorkflowError(500, 'Internal error')

    await saveAndOpenPublishDialog(
      comfyPage,
      publishDialog,
      'test-submit-fail-wf'
    )
    await publishDialog.goToStep('Finish publishing')
    await expect(publishDialog.finishStep).toBeVisible()

    await publishDialog.publishButton.click()

    // Error toast should appear
    await expect(comfyPage.toast.visibleToasts.first()).toBeVisible({
      timeout: 10_000
    })
    // Dialog should remain open
    await expect(publishDialog.root).toBeVisible()
  })
})

const BREAKPOINTS = [
  { name: 'mobile', width: 390 },
  { name: 'sm', width: 640 },
  { name: 'md', width: 768 },
  { name: 'lg', width: 1024 },
  { name: 'xl', width: 1280 },
  { name: '2xl', width: 1536 },
  { name: 'wide', width: 1920 }
] as const

const VIEWPORT_HEIGHT = 800

async function expectWithinViewport(
  dialog: PublishDialog,
  viewport: { width: number; height: number },
  label: string
): Promise<void> {
  await expect
    .poll(
      async () => {
        const box = await dialog.root.boundingBox()
        if (!box) return false

        return (
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= viewport.height
        )
      },
      { message: `dialog escapes the viewport at ${label}` }
    )
    .toBe(true)
}

test.describe('Publish dialog - layout', () => {
  test.beforeEach(async ({ comfyPage, publishApi, publishDialog }) => {
    await comfyPage.featureFlags.setFlags(PUBLISH_FEATURE_FLAGS)
    await publishApi.setupDefaultMocks()
    await saveAndOpenPublishDialog(comfyPage, publishDialog, 'test-layout-wf')
  })

  test('renders fully inside the viewport at every breakpoint', async ({
    comfyPage,
    publishDialog
  }) => {
    await expect(publishDialog.describeStep).toBeVisible()

    for (const { name, width } of BREAKPOINTS) {
      await comfyPage.page.setViewportSize({ width, height: VIEWPORT_HEIGHT })
      await expectWithinViewport(
        publishDialog,
        { width, height: VIEWPORT_HEIGHT },
        `${name} (${width}px)`
      )
    }
  })

  for (const { name, width } of BREAKPOINTS) {
    test(
      `matches the expected layout at ${name}`,
      { tag: ['@screenshot'] },
      async ({ comfyPage, publishDialog }) => {
        await comfyPage.page.setViewportSize({ width, height: VIEWPORT_HEIGHT })
        await expect(publishDialog.describeStep).toBeVisible()
        await expect(publishDialog.nameInput).toHaveValue(/test-layout-wf/)
        await comfyPage.toast.closeToasts()
        await comfyPage.canvas.evaluate((el) => {
          el.style.visibility = 'hidden'
        })

        await expect(comfyPage.page).toHaveScreenshot(
          `publish-dialog-${name}.png`
        )
      }
    )
  }
})
