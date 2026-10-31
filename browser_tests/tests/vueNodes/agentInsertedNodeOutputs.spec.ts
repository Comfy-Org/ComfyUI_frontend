import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const INSERTED_NODE_ID = 'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9'
const INSERTED_HOST_ID = 'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:105'
const INSERTED_INTERIOR_ID =
  'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root/definition:%22a1b2c3d4-e5f6-7890-abcd-ef1234567890%22:node:6'

test.describe('Agent-inserted node outputs', { tag: '@vue-nodes' }, () => {
  test.use({ initialFeatureFlags: { enable_telemetry: true } })

  test('shows the executed image in an agent-inserted Save Image node', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    await comfyPage.workflow.loadWorkflow('vueNodes/agent-inserted-save-image')

    const exec = new ExecutionHelper(comfyPage, ws)
    const jobId = await exec.run()
    exec.executionStart(jobId)
    exec.executing(jobId, INSERTED_NODE_ID)
    exec.executed(jobId, INSERTED_NODE_ID, {
      images: [{ filename: 'example.png', subfolder: '', type: 'input' }]
    })
    exec.executing(jobId, null)
    exec.executionSuccess(jobId)
    exec.status(0)

    await expect(
      comfyPage.vueNodes
        .getNodeByTitle('Save Image')
        .getByRole('img', { name: 'View image 1 of 1' })
    ).toBeVisible()
  })

  test('BE-23369 keeps the live Save Image blank and reports an unresolvable executed output', async ({
    comfyPage,
    getWebSocket,
    page
  }) => {
    const ws = await getWebSocket()
    await comfyPage.workflow.loadWorkflow('vueNodes/agent-inserted-save-image')

    const unresolvedReports: string[] = []
    page.on('console', (message) => {
      if (
        message.text().includes('failure_resolving_node_output_execution_id')
      ) {
        unresolvedReports.push(message.text())
      }
    })

    const exec = new ExecutionHelper(comfyPage, ws)
    const jobId = await exec.run()
    const staleExecutionId =
      'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:404'
    exec.executionStart(jobId)
    exec.executing(jobId, staleExecutionId)
    exec.executed(jobId, staleExecutionId, null)
    exec.executed(jobId, staleExecutionId, {
      images: 'not-an-array'
    })
    exec.executed(jobId, staleExecutionId, {
      images: [{ filename: 'unresolved.png', subfolder: '', type: 'input' }]
    })
    exec.executing(jobId, null)
    exec.executionSuccess(jobId)
    exec.status(0)

    const saveImageNode = comfyPage.vueNodes.getNodeByTitle('Save Image')
    await expect(saveImageNode).toBeVisible()
    await expect(
      saveImageNode.getByRole('img', { name: 'View image 1 of 1' })
    ).toHaveCount(0)
    await expect.poll(() => unresolvedReports.length).toBe(3)
    expect(unresolvedReports).toEqual(
      Array(3).fill(
        expect.stringContaining('failure_resolving_node_output_execution_id')
      )
    )
  })

  test('shows the executed image in a Save Image node inside an agent-inserted subgraph', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    await comfyPage.workflow.loadWorkflow(
      'vueNodes/agent-inserted-subgraph-save-image'
    )

    const exec = new ExecutionHelper(comfyPage, ws)
    const jobId = await exec.run()
    const executionId = `${INSERTED_HOST_ID}:${INSERTED_INTERIOR_ID}`
    exec.executionStart(jobId)
    exec.executing(jobId, executionId)
    exec.executed(jobId, executionId, {
      images: [{ filename: 'example.png', subfolder: '', type: 'input' }]
    })
    exec.executing(jobId, null)
    exec.executionSuccess(jobId)
    exec.status(0)

    await comfyPage.vueNodes.enterSubgraph(INSERTED_HOST_ID)

    const image = comfyPage.vueNodes
      .getNodeByTitle('Save Image')
      .getByRole('img', { name: 'View image 1 of 1' })
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('src', /filename=example\.png/)
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
  })
})
