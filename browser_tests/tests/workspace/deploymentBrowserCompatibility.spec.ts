import { expect } from '@playwright/test'

import { JUST_READY_DEPLOYMENT_ID } from '@e2e/fixtures/data/deploymentListing'
import {
  deploymentCompatibilityTest as test,
  deploymentRecheckTest
} from '@e2e/fixtures/deploymentCompatibilityFixture'

test.describe(
  'Deployment browser compatibility',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({
      initialLocalStorage: {
        'Comfy.Workspace.LastWorkspaceId': 'ws-team'
      }
    })

    test('shows deployment choices without AbortSignal.timeout', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const trigger = page.getByTestId('deployment-switcher-trigger')
      await expect(trigger).toBeVisible()

      await trigger.click()

      await expect(
        page.getByTestId('deployment-row-dep-legacy-browser')
      ).toContainText('Legacy Browser Studio')
    })
  }
)

deploymentRecheckTest.describe(
  'Deployment compatibility recheck',
  { tag: ['@cloud', '@ui'] },
  () => {
    deploymentRecheckTest.use({
      initialLocalStorage: {
        'Comfy.Workspace.LastWorkspaceId': 'ws-team'
      }
    })

    deploymentRecheckTest(
      'Run on lists a just-ready deployment as compatible once the recheck answers',
      async ({ comfyPage }) => {
        const page = comfyPage.page
        const trigger = page.getByTestId('deployment-switcher-trigger')
        const compatible = page.getByRole('group', {
          name: 'Compatible environments'
        })
        const incompatible = page.getByRole('group', {
          name: 'Incompatible environments'
        })
        const rowTestId = `deployment-row-${JUST_READY_DEPLOYMENT_ID}`

        await deploymentRecheckTest.step('Open Run on', async () => {
          await trigger.click()
        })

        await deploymentRecheckTest.step(
          'The deployment moves to the compatible list',
          async () => {
            await expect(compatible.getByTestId(rowTestId)).toBeVisible({
              timeout: 15_000
            })
          }
        )

        await deploymentRecheckTest.step(
          'The deployment is not under Incompatible environments',
          async () => {
            await expect(incompatible.getByTestId(rowTestId)).toHaveCount(0)
          }
        )

        await deploymentRecheckTest.step(
          'The deployment does not say it could not be checked',
          async () => {
            await expect(page.getByTestId(rowTestId)).not.toContainText(
              'Could not check'
            )
          }
        )
      }
    )
  }
)
