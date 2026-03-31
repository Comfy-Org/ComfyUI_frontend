import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PublishDialog } from '@e2e/fixtures/components/PublishDialog'
import { PublishApiHelper } from '@e2e/fixtures/helpers/PublishApiHelper'

test.describe('Publish dialog - wizard navigation', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })

    await publishApi.setupDefaultMocks()

    await comfyPage.menu.topbar.saveWorkflow('test-publish-wf')
    // Handle overwrite confirmation if the file already exists
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
  })

  test('opens on the Describe step by default', async () => {
    await expect(dialog.describeStep).toBeVisible()
    await expect(dialog.nameInput).toBeVisible()
    await expect(dialog.descriptionTextarea).toBeVisible()
  })

  test('pre-fills workflow name from active workflow', async () => {
    await expect(dialog.nameInput).toHaveValue(/test-publish-wf/)
  })

  test('Next button navigates to Examples step', async () => {
    await dialog.goNext()
    await expect(dialog.describeStep).toBeHidden()
    // Examples step should show thumbnail toggle and upload area
    await expect(dialog.root.getByText('Select a thumbnail')).toBeVisible()
  })

  test('Back button returns to Describe step from Examples', async () => {
    await dialog.goNext()
    await expect(dialog.describeStep).toBeHidden()

    await dialog.goBack()
    await expect(dialog.describeStep).toBeVisible()
  })

  test('navigates through all steps to Finish', async () => {
    await dialog.goNext() // → Examples
    await dialog.goNext() // → Finish
    await expect(dialog.finishStep).toBeVisible()
    await expect(dialog.publishButton).toBeVisible()
  })

  test('clicking nav step navigates directly', async () => {
    await dialog.goToStep('Finish publishing')
    await expect(dialog.finishStep).toBeVisible()

    await dialog.goToStep('Describe your workflow')
    await expect(dialog.describeStep).toBeVisible()
  })

  test('closes dialog via Escape key', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog.root).toBeHidden()
  })
})

test.describe('Publish dialog - Describe step', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })

    await publishApi.setupDefaultMocks()
    await comfyPage.menu.topbar.saveWorkflow('test-describe-wf')
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
  })

  test('allows editing the workflow name', async () => {
    await dialog.nameInput.clear()
    await dialog.nameInput.fill('My Custom Workflow')
    await expect(dialog.nameInput).toHaveValue('My Custom Workflow')
  })

  test('allows editing the description', async () => {
    await dialog.descriptionTextarea.fill('A great workflow for anime art')
    await expect(dialog.descriptionTextarea).toHaveValue(
      'A great workflow for anime art'
    )
  })

  test('displays tag suggestions from mocked API', async () => {
    await expect(dialog.root.getByText('anime')).toBeVisible()
    await expect(dialog.root.getByText('upscale')).toBeVisible()
  })

  test('clicking a tag suggestion adds it', async () => {
    const animeTag = dialog.root
      .locator('[data-disabled] [data-tag-item]')
      .filter({ hasText: 'anime' })
    await animeTag.click()

    // The tag should now appear in the active tags list (not in suggestions)
    const activeTags = dialog.describeStep.locator('[role="list"]').first()
    await expect(activeTags.getByText('anime')).toBeVisible()
  })
})

test.describe('Publish dialog - Examples step', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })

    await publishApi.setupDefaultMocks()
    await comfyPage.menu.topbar.saveWorkflow('test-examples-wf')
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
    await dialog.goNext() // Navigate to Examples step
  })

  test('shows thumbnail type toggle options', async () => {
    await expect(dialog.root.getByText('Image', { exact: true })).toBeVisible()
    await expect(dialog.root.getByText('Video', { exact: true })).toBeVisible()
    await expect(
      dialog.root.getByText('Image comparison', { exact: true })
    ).toBeVisible()
  })

  test('shows example image upload tile', async () => {
    await expect(
      dialog.root.getByRole('button', { name: 'Upload example image' })
    ).toBeVisible()
  })
})

test.describe('Publish dialog - Finish step with profile', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })

    await publishApi.setupDefaultMocks({ hasProfile: true })
    await comfyPage.menu.topbar.saveWorkflow('test-finish-wf')
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
    await dialog.goToStep('Finish publishing')
  })

  test('shows profile card with username', async () => {
    await expect(dialog.finishStep).toBeVisible()
    await expect(dialog.root.getByText('@testuser')).toBeVisible()
    await expect(dialog.root.getByText('Test User')).toBeVisible()
  })

  test('publish button is enabled when no private assets', async () => {
    await expect(dialog.publishButton).toBeEnabled()
  })
})

test.describe('Publish dialog - Finish step with private assets', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })

    await publishApi.setupDefaultMocks({
      hasProfile: true,
      hasPrivateAssets: true
    })
    await comfyPage.menu.topbar.saveWorkflow('test-assets-wf')
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
    await dialog.goToStep('Finish publishing')
  })

  test('publish button is disabled until assets acknowledged', async () => {
    await expect(dialog.finishStep).toBeVisible()
    await expect(dialog.publishButton).toBeDisabled()

    // Check the acknowledge checkbox
    const checkbox = dialog.finishStep.getByRole('checkbox')
    await checkbox.check()

    await expect(dialog.publishButton).toBeEnabled()
  })
})

test.describe('Publish dialog - no profile', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })

    await publishApi.setupDefaultMocks({ hasProfile: false })
    await comfyPage.menu.topbar.saveWorkflow('test-noprofile-wf')
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
    await dialog.goToStep('Finish publishing')
  })

  test('shows profile creation prompt when user has no profile', async () => {
    await expect(dialog.profilePrompt).toBeVisible()
    await expect(
      dialog.root.getByText('Create a profile to publish to ComfyHub')
    ).toBeVisible()
  })

  test('clicking create profile CTA shows profile creation form', async () => {
    await dialog.root.getByRole('button', { name: 'Create a profile' }).click()
    await expect(dialog.gateFlow).toBeVisible()
  })
})

test.describe('Publish dialog - unsaved workflow', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })

    await publishApi.setupDefaultMocks()
    // Don't save workflow — open dialog on the default temporary workflow
  })

  test('shows save prompt for temporary workflow', async ({ comfyPage }) => {
    // Create a new workflow to ensure it's temporary
    await comfyPage.menu.topbar.triggerTopbarCommand(['New Workflow'])
    await dialog.open()

    await expect(dialog.savePrompt).toBeVisible()
    await expect(
      dialog.root.getByText('You must save your workflow before publishing')
    ).toBeVisible()
    // Nav should be hidden when save is required
    await expect(dialog.nav).toBeHidden()
  })
})

test.describe('Publish dialog - submission', () => {
  let dialog: PublishDialog
  let publishApi: PublishApiHelper

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new PublishDialog(comfyPage.page)
    publishApi = new PublishApiHelper(comfyPage.page)

    await comfyPage.featureFlags.setFlags({
      comfyhub_upload_enabled: true,
      comfyhub_profile_gate_enabled: true
    })
  })

  test('successful publish closes dialog', async ({ comfyPage }) => {
    await publishApi.setupDefaultMocks({ hasProfile: true })
    await comfyPage.menu.topbar.saveWorkflow('test-submit-wf')
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
    await dialog.goToStep('Finish publishing')
    await expect(dialog.finishStep).toBeVisible()

    await dialog.publishButton.click()
    await expect(dialog.root).toBeHidden({ timeout: 10_000 })
  })

  test('failed publish shows error toast', async ({ comfyPage }) => {
    await publishApi.setupDefaultMocks({ hasProfile: true })
    // Override publish mock with error response
    await publishApi.mockPublishWorkflowError(500, 'Internal error')

    await comfyPage.menu.topbar.saveWorkflow('test-submit-fail-wf')
    const overwriteDialog = comfyPage.page.locator(
      '.p-dialog:has-text("Overwrite")'
    )
    if (await overwriteDialog.isVisible()) {
      await comfyPage.confirmDialog.click('overwrite')
    }

    await dialog.open()
    await dialog.goToStep('Finish publishing')
    await expect(dialog.finishStep).toBeVisible()

    await dialog.publishButton.click()

    // Error toast should appear
    await expect(comfyPage.page.locator('.p-toast-message-error')).toBeVisible({
      timeout: 10_000
    })
    // Dialog should remain open
    await expect(dialog.root).toBeVisible()
  })
})
