import { expect } from '@playwright/test'

import {
  zAgentPostMessageRequest,
  zAgentTurnAccepted,
  zCloudCompatibility
} from '@comfyorg/ingest-types/zod'
import { liveLocalDeploymentAgentFixture as test } from '@e2e/fixtures/liveLocalDeploymentAgentFixture'

test.describe(
  'Open on Cloud real local agent submission',
  { tag: ['@local-deployment-live', '@ui'] },
  () => {
    test('automatically submits one deployment brief to the real local agent', async ({
      comfyPage,
      cloudOrigin,
      agentMessageUrl,
      request
    }) => {
      await test.step('Require the real ready agent and installed custom node', async () => {
        const features = await request.get(
          new URL('/api/features', comfyPage.url).href
        )
        expect(features.status()).toBe(200)
        expect(await features.json()).toMatchObject({
          agent: { state: 'ready' }
        })

        const node = await request.get(
          new URL('/api/object_info/StringFunction%7Cpysssss', comfyPage.url)
            .href
        )
        expect(node.status()).toBe(200)
        expect(await node.json()).toHaveProperty('StringFunction|pysssss')
        await comfyPage.workflow.loadWorkflow(
          'openOnCloud/04-local-agent-deployment'
        )
      })

      await test.step('Read the custom node incompatibility from real Cloud', async () => {
        const compatibilityResponse = comfyPage.page.waitForResponse(
          (response) =>
            response.url() === `${cloudOrigin}/api/cloud/compatibility` &&
            response.request().method() === 'POST'
        )
        await comfyPage.page.getByTestId('cloud-button').click()
        const response = await compatibilityResponse
        expect(response.status()).toBe(200)
        expect(await response.serverAddr()).not.toBeNull()
        const compatibility = zCloudCompatibility.parse(await response.json())
        expect(compatibility.cloud.missing_node_types).toContain(
          'StringFunction|pysssss'
        )
        expect(compatibility.cloud.missing_models).toEqual([])
        await expect(
          comfyPage.page.getByRole('heading', {
            name: 'Deploy your setup to Comfy Cloud',
            exact: true
          })
        ).toBeVisible()
      })

      await test.step('Choose the local agent and await its automatic submission', async () => {
        await comfyPage.page
          .getByRole('button', { name: 'Build with your agent', exact: true })
          .click()
        const submissionResponse = comfyPage.page.waitForResponse(
          (response) =>
            response.url() === agentMessageUrl &&
            response.request().method() === 'POST',
          { timeout: 180_000 }
        )
        await comfyPage.page
          .getByRole('menuitem', { name: 'Use local agent', exact: true })
          .click()
        const response = await submissionResponse
        expect(response.status()).toBe(202)
        expect(await response.serverAddr()).not.toBeNull()
        zAgentTurnAccepted.parse(await response.json())
        const message = zAgentPostMessageRequest.parse(
          response.request().postDataJSON()
        )
        expect(message.content).toContain('to Comfy Cloud')
        expect(message.content).toContain('deploy this local installation')
        expect(message.content).toContain('StringFunction|pysssss')
        expect(message.content).toContain('comfyui-custom-scripts')
        expect(message.content).toContain('1.2.5')
        expect(message.content).toContain(
          'Target platform: https://stagingplatform.comfy.org'
        )
      })

      await test.step('Show one submitted user message with the deployment dialog closed', async () => {
        await expect(
          comfyPage.page.getByTestId('deploy-setup-card')
        ).toBeHidden()
        const messages = comfyPage.page.getByTestId('user-message-bubble')
        await expect(messages).toHaveCount(1)
        await expect(messages).toContainText('deploy this local installation')
        await expect(messages).toContainText('StringFunction|pysssss')
        await expect(messages).toContainText(
          'Target platform: https://stagingplatform.comfy.org'
        )
        await comfyPage.attachScreenshot('local-agent-accepted.png', {
          runInCI: true
        })
      })
    })
  }
)
