import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

/**
 * PM-2037 (recurrence of PM-1826 / PM-1668): the image an agent-built graph
 * produces must appear in the canvas Save Image node, not only in the chat
 * panel.
 *
 * The graph under test is the shape an agent leaves behind: comfy-multi-player's
 * `insert_workflow` remaps every inserted node to
 * `insert:<opId>:root:node:<originalId>`, and the prompt is keyed verbatim by
 * canvas node id, so the `executed` frame names that id. Black-box here means
 * the frames are the ones the backend really sends and the assertion is the
 * rendered image, not a store key.
 */
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
