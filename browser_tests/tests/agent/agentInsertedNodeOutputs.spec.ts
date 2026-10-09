import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const INSERTED_NODE_ID = 'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9'

test.describe('Agent-inserted node outputs', { tag: '@vue-nodes' }, () => {
  test('shows the executed image in an agent-inserted Save Image node', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    await comfyPage.workflow.loadWorkflow('agent-inserted-save-image')

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
})
