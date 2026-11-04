import { expect } from '@playwright/test'

import { deploymentCompatibilityTest as test } from '@e2e/fixtures/deploymentCompatibilityFixture'

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
      await page.getByTestId('getting-started-blank').click()

      const trigger = page.getByTestId('deployment-switcher-trigger')
      await expect(trigger).toBeVisible()

      await trigger.click()

      await expect(
        page.getByTestId('deployment-row-dep-legacy-browser')
      ).toContainText('Legacy Browser Studio')
    })
  }
)
