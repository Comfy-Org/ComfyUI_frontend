import { expect } from '@playwright/test'

import { SignInDialog } from '@e2e/fixtures/components/SignInDialog'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  LOCAL_MODEL_FILE,
  openOnCloudModelUploadFixture as test
} from '@e2e/fixtures/openOnCloudModelUploadFixture'

test.describe('Open on Cloud: upload the models Comfy Cloud lacks', () => {
  test('signs in, uploads the missing LoRA from this computer, then offers Run on Comfy Cloud', async ({
    comfyPage,
    cloudTraffic
  }) => {
    const { page } = comfyPage
    await comfyPage.workflow.loadWorkflow('openOnCloud/missing-uploadable-lora')

    await comfyPage.actionbar.checkCloudCompatibility()
    const card = page.getByTestId('missing-models-card')
    await expect(card.getByText(LOCAL_MODEL_FILE.name)).toBeVisible()
    await card.getByRole('button', { name: 'Sign in to upload' }).click()

    const signIn = new SignInDialog(page)
    await signIn.emailInput.fill(CLOUD_SELF_EMAIL)
    await signIn.passwordInput.fill('correct-horse-battery-staple')
    await signIn.signInButton.click()
    await expect(page.locator('[data-dialog-key="global-signin"]')).toBeHidden()

    await expect(
      card.getByRole('heading', { name: 'Upload 1 model' })
    ).toBeVisible()
    await expect(
      card.getByText(`Total ${LOCAL_MODEL_FILE.buffer.length} B`)
    ).toBeVisible()
    const upload = card.getByTestId('missing-models-upload')
    await expect(upload).toBeDisabled()

    await card
      .getByLabel(`Choose file for ${LOCAL_MODEL_FILE.name}`)
      .setInputFiles(LOCAL_MODEL_FILE)
    await upload.click()

    await expect(
      card.getByText('Comfy Cloud has not confirmed these models yet.')
    ).toBeVisible()
    await expect(
      card.getByRole('button', { name: 'Choose missing files again' })
    ).toBeVisible()
    await card.getByRole('button', { name: 'Confirm uploads' }).click()
    await expect(page.getByTestId('run-on-cloud-card')).toBeVisible()
    expect(cloudTraffic.starts).toHaveLength(1)
    expect(cloudTraffic.starts[0].postDataJSON()).toMatchObject({
      filename: LOCAL_MODEL_FILE.name,
      size_bytes: LOCAL_MODEL_FILE.buffer.length,
      tags: ['models', 'loras']
    })
    expect(await cloudTraffic.starts[0].headerValue('authorization')).toMatch(
      /^Bearer /
    )
    expect(cloudTraffic.stored).toHaveLength(1)
    const [storageWrite] = cloudTraffic.stored
    const length = LOCAL_MODEL_FILE.buffer.length
    expect(await storageWrite.headerValue('content-range')).toBe(
      `bytes 0-${length - 1}/${length}`
    )
    expect(storageWrite.postDataBuffer()).toEqual(LOCAL_MODEL_FILE.buffer)
    expect(cloudTraffic.completes[0].postDataJSON()).toMatchObject({
      filename: LOCAL_MODEL_FILE.name,
      tags: ['models', 'loras']
    })

    await page.context().route(
      (url) => url.pathname === '/' && url.searchParams.has('from_local'),
      (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<title>Cloud handoff</title>'
        })
    )
    const opened = page.waitForEvent('popup')
    await page.getByTestId('run-on-cloud-primary').click()
    const cloud = await opened
    await expect
      .poll(() => new URL(cloud.url()).searchParams.get('workspace'))
      .toBe('ws-personal')
    await cloud.close()
  })

  test('refuses a file that is not the model the workflow uses', async ({
    comfyPage,
    cloudTraffic
  }) => {
    const { page } = comfyPage
    await comfyPage.workflow.loadWorkflow('openOnCloud/missing-uploadable-lora')
    await comfyPage.actionbar.checkCloudCompatibility()
    const card = page.getByTestId('missing-models-card')
    await card.getByRole('button', { name: 'Sign in to upload' }).click()
    const signIn = new SignInDialog(page)
    await signIn.emailInput.fill(CLOUD_SELF_EMAIL)
    await signIn.passwordInput.fill('correct-horse-battery-staple')
    await signIn.signInButton.click()
    await expect(
      card.getByRole('heading', { name: 'Upload 1 model' })
    ).toBeVisible()

    await card
      .getByLabel(`Choose file for ${LOCAL_MODEL_FILE.name}`)
      .setInputFiles({
        ...LOCAL_MODEL_FILE,
        name: 'another_lora.safetensors'
      })

    await expect(
      card.getByText(`Choose ${LOCAL_MODEL_FILE.name} from your models folder.`)
    ).toBeVisible()
    await expect(card.getByTestId('missing-models-upload')).toBeDisabled()
    expect(cloudTraffic.starts).toEqual([])
  })
})

test.describe('Open on Cloud upload rollout disabled', () => {
  test.use({ modelUploadEnabled: false })

  test('shows missing models without offering upload or recovery', async ({
    comfyPage,
    cloudTraffic
  }) => {
    const { page } = comfyPage
    await comfyPage.workflow.loadWorkflow('openOnCloud/missing-uploadable-lora')
    await comfyPage.actionbar.checkCloudCompatibility()

    const card = page.getByTestId('missing-models-card')
    await expect(card.getByText(LOCAL_MODEL_FILE.name)).toBeVisible()
    await expect(
      card.getByRole('button', { name: 'Sign in to upload' })
    ).toHaveCount(0)
    await expect(card.getByTestId('missing-models-upload')).toHaveCount(0)
    await expect(page.getByTestId('cloud-upload-recovery-button')).toHaveCount(
      0
    )
    expect(cloudTraffic.starts).toHaveLength(0)
  })
})
