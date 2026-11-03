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
      idCollision
    }) => {
      const { nodeId } = await driveCollision(idCollision)

      await expect(
        idCollision.page
          .getByTestId('toast')
          .getByText(enMessages.agent.editRejected.overwritten)
      ).toBeVisible()
      await expect(
        idCollision.vueNodes
          .getNodeLocator(nodeId)
          .getByLabel('filename_prefix', { exact: true })
      ).toHaveValue('ComfyUI')
    })

    test('keeps the refreshed canvas aligned with the canonical document', async ({
      idCollision
    }) => {
      const { nodeId } = await driveCollision(idCollision)

      await expect(
        idCollision.vueNodes
          .getNodeLocator(nodeId)
          .getByLabel('filename_prefix', { exact: true })
      ).toHaveValue('ComfyUI')
      const canonicalNode = idCollision.host
        .projection()
        .nodes.find((node) => String(node.id) === nodeId)
      expect(
        canonicalNode,
        `doc should still contain node ${nodeId}`
      ).toBeDefined()
      expect(canonicalNode?.type).toBe('SaveImage')
    })
  }
)
