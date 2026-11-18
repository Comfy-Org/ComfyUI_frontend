import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { liveOpenOnCloudAcceptanceFixture as test } from '@e2e/fixtures/liveOpenOnCloudFixture'

test.use({ billingNewUx: false })

test.describe(
  'Open on Cloud live',
  { tag: ['@cloud-live', '@smoke', '@ui'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await expect(comfyPage.actionbar.topMenuActions).toBeVisible()
    })

    test('hides the Cloud button when signed out', async ({
      comfyPage,
      cloudOrigin,
      loginButton,
      request
    }) => {
      const response = await request.get(`${cloudOrigin}/api/features`)
      expect(response.status()).toBe(200)
      expect(await response.json()).toMatchObject({
        open_on_cloud_enabled: false
      })
      await expect(loginButton.trigger).toBeVisible()
      await expect(comfyPage.actionbar.cloudButton).toHaveCount(0)
    })

    test.describe('signed in', () => {
      test.beforeEach(
        'Sign in with a Cloud-enabled test account',
        async ({ signIn }) => {
          await signIn()
        }
      )

      test('shows the Cloud button after sign-in and hides it again on sign-out', async ({
        comfyPage,
        loginButton
      }) => {
        const { actionbar, currentUserPopover } = comfyPage
        await expect(actionbar.cloudButton).toBeVisible()

        await currentUserPopover.signOut()
        await expect(loginButton.trigger).toBeVisible()
        await expect(actionbar.cloudButton).toHaveCount(0)
      })

      test('opens the Deploy with your agent dialog when Cloud lacks a node', async ({
        comfyPage,
        checkCloudCompatibility,
        openOnCloudDialog
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/02-missing-cloud-node'
        )
        const compatibility = await checkCloudCompatibility()
        expect(compatibility.missing_node_types).toContain('VAESave')
        expect(compatibility.missing_models).toEqual([])

        await expect(openOnCloudDialog.deployHeading).toBeVisible()
        await openOnCloudDialog.deployWithAgentButton.click()
        await openOnCloudDialog.expectAgentOptions()
        await comfyPage.attachScreenshot('missing-cloud-node.png', {
          runInCI: true
        })
      })

      test('opens the Missing models dialog when Cloud lacks a checkpoint', async ({
        comfyPage,
        checkCloudCompatibility,
        openOnCloudDialog
      }) => {
        const checkpoint = '3Guofeng3_v32Light.safetensors'
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/03-missing-cloud-model'
        )
        const compatibility = await checkCloudCompatibility()
        expect(compatibility.missing_node_types).toEqual([])
        expect(compatibility.missing_models).toEqual([
          { folder: 'checkpoints', name: checkpoint }
        ])

        await expect(openOnCloudDialog.missingModelHeading).toBeVisible()
        await expect(openOnCloudDialog.missingModel(checkpoint)).toBeVisible()
        await expect(openOnCloudDialog.uploadsUnavailableNotice).toBeVisible()
        await expect(openOnCloudDialog.uploadButton).toHaveCount(0)
        await comfyPage.attachScreenshot('missing-cloud-model.png', {
          runInCI: true
        })
      })

      test('offers to open a workflow that Cloud can run', async ({
        comfyPage,
        checkCloudCompatibility,
        openOnCloudDialog
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/01-runnable-on-cloud'
        )
        const compatibility = await checkCloudCompatibility()
        expect(compatibility.missing_node_types).toEqual([])
        expect(compatibility.missing_models).toEqual([])

        await expect(openOnCloudDialog.runHeading).toBeVisible()
        await expect(openOnCloudDialog.openOnCloudButton).toBeVisible()
        await comfyPage.attachScreenshot('runnable-on-cloud.png', {
          runInCI: true
        })
      })
    })
  }
)
