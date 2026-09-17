import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import workflow from '@e2e/assets/3d/load3d_node.json' with { type: 'json' }
import { cloudAppFixture, waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { Load3DHelper } from '@e2e/tests/load3d/Load3DHelper'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

const test = cloudAppFixture
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'
const THREAD_ID = 'd4c016c4-3b8c-44cf-97de-1ae27e43e718'

function promptImage(body: unknown): string {
  const prompt = (
    body as { prompt?: Record<string, { inputs?: Record<string, unknown> }> }
  ).prompt
  const image = Object.values(prompt ?? {}).find(
    (node) => node.inputs?.image !== undefined
  )?.inputs?.image
  expect(image).toBeTruthy()
  return (image as { image: string }).image
}

async function bootAgentLoad3d(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
    localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
  })
  await mockCloudBoot(page, {
    features: {
      posthog_project_token: 'phc_e2e_agent_load3d',
      posthog_config: {
        advanced_disable_flags: true,
        bootstrap: { featureFlags: { 'agent-in-app-experience': true } }
      }
    },
    settings: {
      'Comfy.TutorialCompleted': true,
      'Comfy.VueNodes.Enabled': true,
      'Comfy.RightSidePanel.ShowErrorsTab': false
    }
  })
  // Keep the cloud shell deterministic, but use the real black-box backend's
  // Load3D definition so this exercises the production node/viewer.
  await page.unroute('**/api/object_info')
  await mockBilling(page)
  await page.route('**/api/assets**', (route) =>
    route.fulfill(jsonRoute({ assets: [], total: 0, has_more: false }))
  )
  let capture = 0
  await page.route('**/api/upload/image**', (route) =>
    route.fulfill(
      jsonRoute({
        name: `agent-load3d-capture-${++capture}.png`,
        subfolder: 'temp',
        type: 'temp'
      })
    )
  )
  await page.route('**/api/view?*filename=cube.obj*', (route) =>
    route.fulfill({ path: assetPath('cube.obj') })
  )
  await page.route('**/api/view?*filename=workflow.glb*', (route) =>
    route.fulfill({ path: assetPath('workflowInMedia/workflow.glb') })
  )
  await page.route('**://t.comfy.org/**', (route) =>
    route.fulfill(jsonRoute({ status: 1 }))
  )
  await page.route('**/api/agent/threads/*/messages', (route) =>
    route.fulfill(
      jsonRoute({
        message_id: '3818ba00-d772-4a3f-98c1-9312725b577d',
        thread_id: THREAD_ID,
        workflow_id: WORKFLOW_ID
      })
    )
  )
  await page.route(/\/api\/prompt$/, (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill(
      jsonRoute({ prompt_id: crypto.randomUUID(), node_errors: {} })
    )
  })
  await bootCloud(page)
  await page.goto(new URL('/?agentCrdtFollower=1', APP_URL).toString())
  await waitForCloudApp(page)
  await page.evaluate(
    async (data) => {
      await window.app!.loadGraphData(data, true, true)
    },
    workflow as unknown as ComfyWorkflowJSON
  )
  await expect(page.locator('[data-node-id="1"]')).toBeVisible()
}

async function captureNextPrompt(page: Page): Promise<string> {
  const request = page.waitForRequest(
    (value) =>
      value.method() === 'POST' &&
      new URL(value.url()).pathname === '/api/prompt'
  )
  await page.getByTestId('queue-button').click()
  return promptImage((await request).postDataJSON())
}

async function setRemoteModel(page: Page, value: string, opId: string) {
  await page.evaluate(
    async ({ value, opId }) => {
      const root = document.querySelector('#vue-app') as Element & {
        __vue_app__?: {
          _context: { provides: Record<PropertyKey, unknown> }
        }
      }
      const pinia = Reflect.ownKeys(root.__vue_app__?._context.provides ?? {})
        .map(
          (key) =>
            root.__vue_app__?._context.provides[key] as
              | { _s?: Map<string, unknown> }
              | undefined
        )
        .find((candidate) => candidate?._s instanceof Map)
      const widgetStore = pinia?._s?.get('widgetValue') as
        | {
            setValue: (
              id: string,
              nextValue: string,
              context: Record<string, string>
            ) => boolean
          }
        | undefined
      const modelWidget = window
        .app!.graph.getNodeById('1' as never)
        ?.widgets?.find((widget) => widget.name === 'model_file')
      if (!widgetStore || !modelWidget?.widgetId) {
        throw new Error('model_file widget store binding unavailable')
      }
      if (
        !widgetStore.setValue(modelWidget.widgetId, value, {
          source: 'agent-remote',
          actor: 'agent:e2e',
          opId
        })
      ) {
        throw new Error('remote model_file update was not applied')
      }
    },
    { value, opId }
  )
}

test.describe('Load3D agent updates', { tag: '@cloud' }, () => {
  test('an agent model_file update refreshes the viewer and capture cache', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await bootAgentLoad3d(page)
    const load3d = new Load3DHelper(page.locator('[data-node-id="1"]'))
    await expect(load3d.canvas).toBeVisible()
    await setRemoteModel(page, 'cube.obj', 'load3d-model-a')
    await load3d.waitForModelLoaded()
    const beforeImage = await captureNextPrompt(page)
    await setRemoteModel(page, 'workflow.glb', 'load3d-model-update')

    await expect
      .poll(() =>
        page.evaluate(
          (nodeId) =>
            window
              .app!.graph.getNodeById(nodeId)
              ?.widgets?.find((widget) => widget.name === 'model_file')?.value,
          toNodeId('1')
        )
      )
      .toBe('workflow.glb')
    await load3d.waitForModelLoaded()
    const afterImage = await captureNextPrompt(page)
    expect(afterImage).not.toBe(beforeImage)
    await expect(load3d.canvas).toBeVisible()
    await test.info().attach('agent-updated-load3d.png', {
      body: await load3d.node.screenshot(),
      contentType: 'image/png'
    })
  })
})
