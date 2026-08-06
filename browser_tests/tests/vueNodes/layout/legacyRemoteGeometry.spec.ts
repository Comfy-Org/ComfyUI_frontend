import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.describe(
  'Legacy remote geometry',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    test('retains geometry from a rect-only Yjs update', async ({
      comfyPage
    }) => {
      const REMOTE_RECT = [640, 360, 320, 180] as const
      await comfyPage.workflow.loadWorkflow('default')

      const nodeId = toNodeId(
        await comfyPage.vueNodes.getNodeIdByTitle('Load Checkpoint')
      )
      const graphId = await comfyPage.page.evaluate(
        () => window.app!.rootGraph.id
      )

      await comfyPage.page.addScriptTag({
        type: 'module',
        content: `
          import { layoutStore } from '/src/renderer/core/layout/store/layoutStore.ts'

          const doc = layoutStore.getYDoc()
          const node = doc.getMap('nodes').get('${graphId}:${nodeId}')
          doc.transact(() => {
            node.delete('position')
            node.delete('size')
            node.set('rect', ${JSON.stringify(REMOTE_RECT)})
          })
          document.documentElement.dataset.remoteLayoutApplied = 'true'
        `
      })
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => document.documentElement.dataset.remoteLayoutApplied
          )
        )
        .toBe('true')

      await expect
        .poll(() =>
          comfyPage.page.evaluate((id) => {
            const node = window.app!.graph.getNodeById(id)
            if (!node) return null
            return {
              position: [...node.pos],
              size: [...node.size]
            }
          }, nodeId)
        )
        .toEqual({
          position: REMOTE_RECT.slice(0, 2),
          size: REMOTE_RECT.slice(2)
        })
    })
  }
)
