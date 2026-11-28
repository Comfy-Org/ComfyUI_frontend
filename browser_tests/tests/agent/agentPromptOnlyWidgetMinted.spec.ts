import { expect } from '@playwright/test'

import { AgentNonValueWidgetRig } from '@e2e/fixtures/agentNonValueWidgetRig'
import {
  PROMPT_ONLY_EDITED_SEED,
  promptOnlyWidgetRigConfig
} from '@e2e/fixtures/data/agent/promptOnlyWidget'
import { agentTest as test } from '@e2e/fixtures/agentPanelFixture'

test.describe(
  'Agent CRDT: prompt-only widget values mint into the shared document',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('a prompt input omitted from workflow persistence reaches the host and stays visible', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const rig = await AgentNonValueWidgetRig.boot(
        page,
        promptOnlyWidgetRigConfig
      )

      const nodeId =
        await test.step('add a node whose seed is prompt-only from creation', async () => {
          return await rig.addPromptOnlySampler()
        })

      await test.step('edit the prompt-only value through the live widget API', async () => {
        await rig.editSeedOnNode(nodeId, PROMPT_ONLY_EDITED_SEED)
      })

      await test.step('the host applies the semantic write', async () => {
        await expect
          .poll(() => rig.hostSocket.humanOpOutcomes().map((o) => o.outcome))
          .toEqual(['applied', 'applied'])
        expect(
          rig.host.projection().nodes.find((node) => String(node.id) === nodeId)
            ?.widgets_values
        ).toEqual(
          expect.objectContaining({
            seed: PROMPT_ONLY_EDITED_SEED,
            steps: 20
          })
        )
      })

      await test.step('the edited value remains visible on the canvas', async () => {
        await expect(rig.seedField(nodeId)).toHaveValue(
          String(PROMPT_ONLY_EDITED_SEED)
        )
      })
    })
  }
)
