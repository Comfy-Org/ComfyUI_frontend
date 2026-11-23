import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  driveCollision,
  idCollisionTest as test
} from '@e2e/fixtures/agentCrdtIdCollisionFixture'

test.describe(
  'Agent/frontend node id collision recovery',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('surfaces the overwritten edit and refreshes the canvas', async ({
      idCollision,
      toast
    }) => {
      const { nodeId } = await driveCollision(idCollision)

      await expect(
        toast.withText(enMessages.agent.editRejected.overwritten)
      ).toBeVisible()
      await expect(
        idCollision.vueNodes
          .getNodeLocator(nodeId)
          .getByLabel('filename_prefix', { exact: true })
      ).toHaveValue('ComfyUI')
    })
  }
)
