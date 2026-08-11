import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  customNodeSuiteSettings,
  drainBackendToIdle,
  trackSubmittedPrompts
} from '@e2e/fixtures/utils/customNodeSuite'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'
import {
  assertSharedCustomNodeSession,
  readSharedCustomNodeSession,
  sharedCustomNodeSessionEnabled
} from '@e2e/fixtures/utils/sharedCustomNodeSession'

test.use({ initialSettings: customNodeSuiteSettings })

test.beforeEach(async ({ comfyPage }) => {
  trackSubmittedPrompts(comfyPage.page)
})

test.afterEach(async ({ comfyPage }) => {
  await drainBackendToIdle(comfyPage.page, 10_000)
})

if (sharedCustomNodeSessionEnabled()) {
  test('shared session continuity after broken tier @custom-nodes', async ({
    comfyPage
  }, testInfo) => {
    const state = await readSharedCustomNodeSession(comfyPage.page)
    assertSharedCustomNodeSession(state)

    await comfyPage.nodeOps.addNode('EmptyImage')
    await comfyPage.nextFrame()
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
    await expectNoVisibleErrors(
      comfyPage.page,
      'after shared-session reconnect'
    )

    await testInfo.attach('shared-session-identity.json', {
      body: Buffer.from(
        JSON.stringify({
          bootCount: state.bootCount,
          id: state.id,
          pid: process.pid
        })
      ),
      contentType: 'application/json'
    })
  })
}
